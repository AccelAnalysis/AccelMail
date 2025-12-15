import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Menu, X, ChevronRight, ChevronLeft, Check, 
  Target, Upload, Map as MapIcon, Users, 
  CreditCard, Building, Mail, 
  Calendar, CheckCircle2, ArrowRight, Layout
} from 'lucide-react';
import { 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  updateDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from './src/firebase';

// --- FIREBASE CONFIGURATION & INIT ---
// Config is now handled in src/firebase.js
const appId = import.meta.env.VITE_APP_ID || 'default-app-id';

// --- LEAFLET LOADER HOOK ---
// Dynamically loads Leaflet CSS and JS since we cannot use npm install for standard Leaflet in this environment
const useLeaflet = () => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (window.L) {
      setLoaded(true);
      return;
    }

    // Load CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    // Load JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => setLoaded(true);
    document.body.appendChild(script);

    return () => {
      // Cleanup if needed, though usually we keep libraries once loaded
    };
  }, []);

  return loaded;
};

// --- DATA CONSTANTS (From target_market_survey.html) ---
const SURVEY_DATA = {
  B2B: {
    industries: [
      "Construction & Trades", "Manufacturing", "Transportation / Logistics",
      "Professional Services", "Medical / Healthcare", "Restaurants & Food",
      "Retail (Brick-and-Mortar)", "E-commerce", "Real Estate / Property Mgmt", "Nonprofits"
    ],
    revenues: ["Under $500k", "$500k–$1M", "$1M–$5M", "$5M–$20M", "$20M+"],
    employees: ["0–2 (Micro)", "3–9 (Small Team)", "10–24 (Growing)", "25–49", "50+"]
  },
  B2C: {
    ages: ["18-24 (Gen Z)", "25-34 (Millennials)", "35-44", "45-54", "55-64", "65+ (Seniors)"],
    incomes: ["Any", "Budget Conscious", "Middle Income", "Affluent", "High Net Worth"],
    families: ["Singles", "Couples", "Parents with Kids", "Empty Nesters"]
  }
};

const UPLOAD_LIST_TEMPLATE_HEADERS = ['FirstName', 'LastName', 'Address1', 'Address2', 'City', 'State', 'Zip'];

// --- COMPONENTS ---

// 1. Map Component (Leaflet)
const MapComponent = ({ lat, lng, radius, onLocationChange }) => {
  const isLoaded = useLeaflet();
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const mapContainerId = useMemo(() => `map-${Math.random().toString(36).substr(2, 9)}`, []);

  // Use ref for onLocationChange to avoid stale closures in event listeners
  const onLocationChangeRef = useRef(onLocationChange);
  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  useEffect(() => {
    if (!isLoaded || !document.getElementById(mapContainerId)) return;

    // Initialize Map if not exists
    if (!mapRef.current) {
      const L = window.L;
      const initialLat = lat || 36.8460;
      const initialLng = lng || -76.2881;

      const map = L.map(mapContainerId).setView([initialLat, initialLng], 13);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      // Add Marker
      const marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(map);
      
      // Add Circle
      const circle = L.circle([initialLat, initialLng], {
        color: '#2563eb',
        fillColor: '#3b82f6',
        fillOpacity: 0.2,
        radius: (radius || 1) * 1609.34 // miles to meters
      }).addTo(map);

      // Events
      marker.on('dragend', (e) => {
        const newPos = e.target.getLatLng();
        circle.setLatLng(newPos);
        if (onLocationChangeRef.current) {
          onLocationChangeRef.current({ lat: newPos.lat, lng: newPos.lng, radius });
        }
      });

      map.on('click', (e) => {
        marker.setLatLng(e.latlng);
        circle.setLatLng(e.latlng);
        if (onLocationChangeRef.current) {
          onLocationChangeRef.current({ lat: e.latlng.lat, lng: e.latlng.lng, radius });
        }
      });

      mapRef.current = map;
      markerRef.current = marker;
      circleRef.current = circle;
    }
  }, [isLoaded, mapContainerId, lat, lng, radius]);

  // Sync map with lat/lng props (e.g. from search)
  useEffect(() => {
    if (mapRef.current && markerRef.current && circleRef.current && lat && lng) {
      const curPos = markerRef.current.getLatLng();
      if (curPos.lat !== lat || curPos.lng !== lng) {
        const newLatLng = [lat, lng];
        markerRef.current.setLatLng(newLatLng);
        circleRef.current.setLatLng(newLatLng);
        mapRef.current.setView(newLatLng);
      }
    }
  }, [lat, lng]);

  // Update radius when prop changes
  useEffect(() => {
    if (circleRef.current && window.L && radius) {
      circleRef.current.setRadius(radius * 1609.34);
    }
  }, [radius]);

  if (!isLoaded) return <div className="h-64 bg-slate-100 flex items-center justify-center text-slate-400">Loading Map...</div>;

  return <div id={mapContainerId} className="h-full w-full z-0" />;
};

// 2. Navigation
const Navigation = ({ activePage, navigate, mobileMenuOpen, setMobileMenuOpen }) => (
  <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200">
    <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
      {/* Logo */}
      <div 
        className="flex items-center gap-2 cursor-pointer" 
        onClick={() => navigate('home')}
      >
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">A</div>
        <span className="font-bold text-lg text-slate-800 tracking-tight">AccelMail</span>
      </div>

      {/* Desktop Links */}
      <div className="hidden md:flex items-center gap-8">
        {['How It Works', 'Segments', 'Pricing', 'About'].map((item) => (
          <button 
            key={item}
            onClick={() => navigate(item.toLowerCase().replace(/\s/g, ''))}
            className="text-sm font-medium text-slate-600 hover:text-blue-600 transition"
          >
            {item}
          </button>
        ))}
        <button 
          onClick={() => navigate('wizard')}
          className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition"
        >
          Start Campaign
        </button>
      </div>

      {/* Mobile Toggle */}
      <button 
        className="md:hidden p-2 text-slate-600"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>
    </div>

    {/* Mobile Menu */}
    {mobileMenuOpen && (
      <div className="md:hidden absolute top-16 left-0 right-0 bg-white border-b border-slate-200 shadow-xl p-4 flex flex-col gap-4">
        {['Home', 'How It Works', 'Segments', 'Pricing', 'About'].map((item) => (
          <button 
            key={item}
            onClick={() => { navigate(item.toLowerCase().replace(/\s/g, '')); setMobileMenuOpen(false); }}
            className="text-left font-medium text-slate-600 py-2 border-b border-slate-50"
          >
            {item}
          </button>
        ))}
        <button 
          onClick={() => { navigate('wizard'); setMobileMenuOpen(false); }}
          className="bg-blue-600 text-white w-full py-3 rounded-lg font-bold mt-2"
        >
          Start Campaign
        </button>
      </div>
    )}
  </nav>
);

const PageShell = ({ title, subtitle, children, navigate, mobileMenuOpen, setMobileMenuOpen }) => (
  <div className="min-h-screen bg-white font-sans text-slate-800">
    <Navigation activePage="page" navigate={navigate} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />
    <main className="max-w-5xl mx-auto px-4 py-12">
      <header className="mb-10">
        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="mt-3 text-lg text-slate-500 max-w-3xl">{subtitle}</p>}
      </header>
      {children}
    </main>
    <footer className="bg-white border-t border-slate-200 py-10 px-4">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-slate-800 rounded flex items-center justify-center text-white text-xs font-bold">A</div>
          <span className="font-bold text-slate-800">AccelMail</span>
        </div>
        <p className="text-slate-400 text-sm">&copy; 2025 Accel Analysis. All rights reserved.</p>
      </div>
    </footer>
  </div>
);

// 3. Wizard Steps

const WizardStepProfile = ({ data, updateData }) => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="text-center mb-8">
      <h2 className="text-2xl font-bold text-slate-900">Let's get started</h2>
      <p className="text-slate-500">First, tell us a bit about your business.</p>
    </div>
    
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Business Name</label>
        <div className="relative">
          <Building className="absolute left-3 top-3 text-slate-400" size={18} />
          <input 
            type="text" 
            value={data.businessName || ''}
            onChange={(e) => updateData({ businessName: e.target.value })}
            className="w-full pl-10 p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Acme Corp"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
          <input 
            type="text" 
            value={data.firstName || ''}
            onChange={(e) => updateData({ firstName: e.target.value })}
            className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Jane"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
          <input 
            type="text" 
            value={data.lastName || ''}
            onChange={(e) => updateData({ lastName: e.target.value })}
            className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Doe"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
          <input 
            type="email" 
            value={data.email || ''}
            onChange={(e) => updateData({ email: e.target.value })}
            className="w-full pl-10 p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="jane@example.com"
          />
        </div>
      </div>
    </div>
  </div>
);

const WizardStepSource = ({ data, updateData }) => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="text-center mb-8">
      <h2 className="text-2xl font-bold text-slate-900">Choose your audience</h2>
      <p className="text-slate-500">How would you like to target your prospects?</p>
    </div>

    <div className="grid gap-4">
      {[
        { id: 'survey', icon: Target, title: 'Build from Segment', desc: 'I need help defining my ideal customer profile.' },
        { id: 'upload', icon: Upload, title: 'Upload List', desc: 'I have a CSV list of addresses ready to go.' },
        { id: 'eddm', icon: MapIcon, title: 'Route Coverage (EDDM)', desc: 'I want to saturate specific neighborhoods.' }
      ].map((opt) => (
        <button
          key={opt.id}
          onClick={() => updateData({ source: opt.id })}
          className={`relative p-6 rounded-xl border-2 text-left transition-all group ${
            data.source === opt.id 
              ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' 
              : 'border-slate-200 bg-white hover:border-blue-300'
          }`}
        >
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full ${data.source === opt.id ? 'bg-blue-200 text-blue-700' : 'bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-600'}`}>
              <opt.icon size={24} />
            </div>
            <div>
              <h3 className={`font-bold text-lg ${data.source === opt.id ? 'text-blue-900' : 'text-slate-900'}`}>{opt.title}</h3>
              <p className="text-sm text-slate-500 mt-1">{opt.desc}</p>
            </div>
            {data.source === opt.id && (
              <div className="absolute top-6 right-6 text-blue-600">
                <CheckCircle2 size={24} />
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  </div>
);

const WizardStepSurvey = ({ data, updateData }) => {
  const [mode, setMode] = useState(data.surveyMode || 'B2B');

  const toggleMode = (m) => {
    setMode(m);
    updateData({ surveyMode: m });
  };

  const toggleSelection = (category, item) => {
    const current = data.surveyData?.[category] || [];
    const updated = current.includes(item)
      ? current.filter(i => i !== item)
      : [...current, item];
    
    updateData({
      surveyData: {
        ...data.surveyData,
        [category]: updated
      }
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-900">Define Segments</h2>
        <p className="text-slate-500 mb-6">Who is your perfect customer?</p>
        
        {/* Mode Toggle */}
        <div className="inline-flex bg-slate-100 p-1 rounded-lg">
          <button 
            onClick={() => toggleMode('B2B')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition ${mode === 'B2B' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
          >
            Business (B2B)
          </button>
          <button 
            onClick={() => toggleMode('B2C')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition ${mode === 'B2C' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-500'}`}
          >
            Consumer (B2C)
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {mode === 'B2B' ? (
          <>
            <div className="bg-white p-5 rounded-xl border border-slate-200">
              <label className="block text-sm font-bold text-slate-900 mb-3">Target Industries</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SURVEY_DATA.B2B.industries.map(ind => (
                  <label key={ind} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={data.surveyData?.industries?.includes(ind) || false}
                      onChange={() => toggleSelection('industries', ind)}
                      className="w-4 h-4 text-blue-600 rounded" 
                    />
                    <span className="text-sm text-slate-700">{ind}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="bg-white p-5 rounded-xl border border-slate-200">
              <label className="block text-sm font-bold text-slate-900 mb-3">Revenue Range</label>
              <div className="flex flex-wrap gap-2">
                {SURVEY_DATA.B2B.revenues.map(rev => (
                  <button
                    key={rev}
                    onClick={() => toggleSelection('revenue', rev)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                      data.surveyData?.revenue?.includes(rev) 
                        ? 'bg-blue-50 border-blue-500 text-blue-700' 
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {rev}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white p-5 rounded-xl border border-slate-200">
              <label className="block text-sm font-bold text-slate-900 mb-3">Age Groups</label>
              <div className="grid grid-cols-2 gap-2">
                {SURVEY_DATA.B2C.ages.map(age => (
                  <label key={age} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={data.surveyData?.ages?.includes(age) || false}
                      onChange={() => toggleSelection('ages', age)}
                      className="w-4 h-4 text-green-600 rounded" 
                    />
                    <span className="text-sm text-slate-700">{age}</span>
                  </label>
                ))}
              </div>
            </div>
             <div className="bg-white p-5 rounded-xl border border-slate-200">
              <label className="block text-sm font-bold text-slate-900 mb-3">Family Status</label>
              <div className="flex flex-wrap gap-2">
                {SURVEY_DATA.B2C.families.map(fam => (
                  <button
                    key={fam}
                    onClick={() => toggleSelection('families', fam)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                      data.surveyData?.families?.includes(fam) 
                        ? 'bg-green-50 border-green-500 text-green-700' 
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {fam}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const WizardStepMap = ({ data, updateData }) => {
  const [radius, setRadius] = useState(data.mapRadius || 1);
  const [address, setAddress] = useState('');

  const handleSearch = async () => {
    if (!address) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`);
      const results = await res.json();
      if (results && results.length > 0) {
        updateData({
          mapLat: parseFloat(results[0].lat),
          mapLng: parseFloat(results[0].lon)
        });
      }
    } catch (e) {
      console.error("Geocoding failed", e);
    }
  };

  const handleLocationChange = (loc) => {
    updateData({
      mapLat: loc.lat,
      mapLng: loc.lng
    });
  };

  const handleRadiusChange = (e) => {
    const r = parseFloat(e.target.value);
    setRadius(r);
    updateData({ mapRadius: r });
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-900">Map & Reach</h2>
        <p className="text-sm text-slate-500">Pinpoint your target area.</p>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-4">
        <input 
          type="text" 
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter zip code or city..."
          className="flex-1 p-2.5 border border-slate-300 rounded-lg text-sm"
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button 
          onClick={handleSearch}
          className="bg-slate-800 text-white px-4 rounded-lg text-sm font-medium"
        >
          Search
        </button>
      </div>

      {/* Map Container - Full Height */}
      <div className="flex-1 relative rounded-xl overflow-hidden border border-slate-200 min-h-[300px]">
        <MapComponent 
          lat={data.mapLat} 
          lng={data.mapLng} 
          radius={radius}
          onLocationChange={handleLocationChange}
        />
        
        {/* Floating Controls */}
        <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur p-4 rounded-xl shadow-lg border border-slate-200 z-[400]">
          <div className="flex justify-between items-center mb-2">
             <span className="text-xs font-bold text-slate-500 uppercase">Target Radius</span>
             <span className="text-blue-600 font-bold">{radius.toFixed(1)} mi</span>
          </div>
          <input 
            type="range" 
            min="0.1" 
            max="20" 
            step="0.1" 
            value={radius}
            onChange={handleRadiusChange}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" 
          />
        </div>
      </div>
    </div>
  );
};

const WizardStepUpload = ({ data, updateData }) => {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      updateData({ uploadedFileName: file.name, uploadedFile: file });
    }
  };

  const handleDownloadTemplate = () => {
    const sampleRow = ['Jane', 'Doe', '123 Main St', '', 'Norfolk', 'VA', '23510'];
    const csv = `${UPLOAD_LIST_TEMPLATE_HEADERS.join(',')}\n${sampleRow.join(',')}\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'accelmail-upload-template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Upload Your List</h2>
        <p className="text-slate-500">Upload your CSV file containing customer addresses.</p>
      </div>

      <div 
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition cursor-pointer ${data.uploadedFileName ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:bg-slate-50 bg-slate-50/50'}`}
      >
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden" 
          accept=".csv,.xls,.xlsx"
        />
        
        {data.uploadedFileName ? (
          <>
             <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">File Selected</h3>
            <p className="text-blue-600 font-medium mb-6">{data.uploadedFileName}</p>
            <button onClick={() => fileInputRef.current?.click()} className="text-sm text-slate-500 underline hover:text-slate-800">Change File</button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Drag and drop your CSV here</h3>
            <p className="text-slate-500 text-sm mb-6">or click to browse files</p>
            <button className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition shadow-sm">
              Select File
            </button>
            <p className="text-xs text-slate-400 mt-4">Supported formats: .csv, .xls, .xlsx</p>
          </>
        )}
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-slate-900">Need a template?</div>
          <div className="text-xs text-slate-500 mt-1">Download a CSV with the required headers: {UPLOAD_LIST_TEMPLATE_HEADERS.join(', ')}</div>
        </div>
        <button onClick={handleDownloadTemplate} className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-800 transition">
          Download CSV Template
        </button>
      </div>

      <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex gap-3">
        <div className="text-blue-600 shrink-0 mt-0.5">
           <CheckCircle2 size={18} />
        </div>
        <div>
          <h4 className="font-bold text-blue-900 text-sm">We'll clean your list</h4>
          <p className="text-blue-700 text-xs mt-1">
            Our system automatically verifies addresses and removes duplicates before mailing.
          </p>
        </div>
      </div>
    </div>
  );
};

const WizardStepCreative = ({ data, updateData }) => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
     <div className="text-center mb-8">
      <h2 className="text-2xl font-bold text-slate-900">Design & Quantity</h2>
      <p className="text-slate-500">Customize your mailer design and select volume.</p>
    </div>

    {/* Creative Choice */}
    <div className="space-y-4">
      <label className="block text-sm font-bold text-slate-900">Design Preference</label>
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => updateData({ creativeType: 'upload' })}
          className={`p-4 rounded-xl border-2 text-center transition ${data.creativeType === 'upload' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}
        >
          <Upload className="mx-auto mb-2 text-slate-600" />
          <div className="font-semibold text-sm">Upload Design</div>
          <div className="text-xs text-slate-400 mt-1">I have a PDF/Image</div>
        </button>
        <button
          onClick={() => updateData({ creativeType: 'custom' })}
          className={`p-4 rounded-xl border-2 text-center transition ${data.creativeType === 'custom' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}
        >
          <Layout className="mx-auto mb-2 text-slate-600" />
          <div className="font-semibold text-sm">Professional Design</div>
          <div className="text-xs text-slate-400 mt-1">Create for me</div>
        </button>
      </div>
    </div>

    {/* Format */}
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">Mailer Format</label>
      <select 
        value={data.mailerFormat || ''}
        onChange={(e) => updateData({ mailerFormat: e.target.value })}
        className="w-full p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
      >
        <option value="">Select Format...</option>
        <option value="Postcard 4x6">Standard Postcard (4x6)</option>
        <option value="Postcard 6x9">Jumbo Postcard (6x9)</option>
        <option value="Letter">Letter in Envelope</option>
      </select>
    </div>

    {/* Quantity */}
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">Quantity</label>
      <div className="relative">
        <Users className="absolute left-3 top-3 text-slate-400" size={18} />
        <input 
          type="number" 
          value={data.quantity || ''}
          onChange={(e) => updateData({ quantity: parseInt(e.target.value) || '' })}
          className="w-full pl-10 p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
          placeholder="e.g. 1000"
          min="100"
        />
      </div>
      <p className="text-xs text-slate-500 mt-2 ml-1">Minimum order: 100 pieces</p>
    </div>
  </div>
);

const WizardStepCadence = ({ data, updateData }) => (
  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="text-center mb-8">
      <h2 className="text-2xl font-bold text-slate-900">Schedule & Cadence</h2>
      <p className="text-slate-500">When should we send your campaign?</p>
    </div>

    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">Cadence Strategy</label>
      <div className="space-y-3">
        <label className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition ${data.cadence === 'single' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}>
          <input 
            type="radio" 
            name="cadence"
            checked={data.cadence === 'single'}
            onChange={() => updateData({ cadence: 'single' })}
            className="mt-1 text-blue-600 focus:ring-blue-500" 
          />
          <div>
            <div className="font-bold text-slate-900">One-Time Blast</div>
            <p className="text-sm text-slate-500 mt-1">Send a single mailer to your target list immediately or on a specific date.</p>
          </div>
        </label>
        
        <label className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition ${data.cadence === 'multi' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}>
          <input 
            type="radio" 
            name="cadence"
            checked={data.cadence === 'multi'}
            onChange={() => updateData({ cadence: 'multi' })}
            className="mt-1 text-blue-600 focus:ring-blue-500" 
          />
          <div>
            <div className="font-bold text-slate-900">Multi-Touch Sequence</div>
            <p className="text-sm text-slate-500 mt-1">Automatic follow-ups. E.g., send a second mailer 2 weeks later to those who haven't converted.</p>
          </div>
        </label>
      </div>
    </div>

    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">Target Start Date</label>
      <div className="relative">
        <Calendar className="absolute left-3 top-3 text-slate-400" size={18} />
        <input 
          type="date" 
          value={data.startDate || ''}
          onChange={(e) => updateData({ startDate: e.target.value })}
          className="w-full pl-10 p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>
    </div>
  </div>
);

const WizardStepReview = ({ data, isSubmitting }) => {
  const quantity = data.quantity || 1000;
  const format = data.mailerFormat || 'Postcard 4x6';
  
  const getPricePerPiece = () => {
    let base = 0.70;
    if (format.includes('6x9')) base = 0.90;
    if (format.includes('Letter')) base = 1.10;
    
    // Simple volume discount
    if (quantity >= 5000) base -= 0.05;
    if (quantity >= 10000) base -= 0.10;
    
    return base;
  };

  const pricePerPiece = getPricePerPiece();
  const total = (quantity * pricePerPiece).toFixed(2);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Review & Launch</h2>
        <p className="text-slate-500">Review your campaign details and estimated cost.</p>
      </div>

      <div className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-800">Campaign Summary</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500 block">Targeting Source</span>
              <span className="font-medium text-slate-900 capitalize">{data.source === 'eddm' ? 'Route Coverage' : data.source}</span>
            </div>
             <div>
              <span className="text-slate-500 block">Audience</span>
              <span className="font-medium text-slate-900">
                 {data.source === 'survey' ? `${data.surveyMode} Segments` : (data.uploadedFileName || 'Uploaded List')}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Format</span>
              <span className="font-medium text-slate-900">{format}</span>
            </div>
             <div>
              <span className="text-slate-500 block">Cadence</span>
              <span className="font-medium text-slate-900 capitalize">{data.cadence === 'multi' ? 'Multi-Touch' : 'One-Time Blast'}</span>
            </div>
             <div>
              <span className="text-slate-500 block">Creative</span>
              <span className="font-medium text-slate-900 capitalize">{data.creativeType === 'upload' ? 'Customer Provided' : 'Professional Design'}</span>
            </div>
             <div>
              <span className="text-slate-500 block">Quantity</span>
              <span className="font-medium text-slate-900">{quantity.toLocaleString()} pieces</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl overflow-hidden border border-blue-200 shadow-sm ring-4 ring-blue-50/50">
         <div className="bg-blue-600 px-6 py-4 text-white flex justify-between items-center">
          <h3 className="font-bold flex items-center gap-2"><CreditCard size={20}/> Estimated Total</h3>
          <span className="text-2xl font-bold">${total}</span>
        </div>
        <div className="p-6">
          <div className="flex justify-between text-sm mb-2">
             <span className="text-slate-600">Unit Price (includes postage)</span>
             <span className="font-medium text-slate-900">${pricePerPiece.toFixed(2)} / piece</span>
          </div>
           <div className="flex justify-between text-sm mb-4">
             <span className="text-slate-600">Estimated Quantity</span>
             <span className="font-medium text-slate-900">{quantity.toLocaleString()}</span>
          </div>
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500 leading-relaxed">
              *This is an estimate. Final pricing will be confirmed after design review and address validation. You will not be charged today.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const WizardStepSuccess = ({ onReset }) => (
  <div className="text-center py-8 animate-in zoom-in duration-300">
    <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600 shadow-xl shadow-green-100">
      <Check size={48} />
    </div>
    <h2 className="text-3xl font-bold text-slate-900 mb-4">Campaign Request Received!</h2>
    <p className="text-lg text-slate-600 mb-8 max-w-md mx-auto">
      We've saved your campaign profile. An AccelMail strategist will review your segments and contact you within 24 hours with a final proof and invoice.
    </p>
    
    <div className="bg-slate-50 max-w-sm mx-auto rounded-xl p-6 border border-slate-200 mb-8 text-left">
      <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-2"><CheckCircle2 size={16} className="text-blue-600"/> What happens next?</h4>
      <ol className="space-y-3 text-sm text-slate-600 list-decimal pl-4">
        <li>Our design team reviews your assets (or starts designing).</li>
        <li>We run your list through NCOA verification.</li>
        <li>You receive a final digital proof and invoice.</li>
        <li>Production starts immediately upon approval.</li>
      </ol>
    </div>

    <button 
      onClick={onReset}
      className="bg-slate-900 text-white px-8 py-4 rounded-xl font-bold hover:bg-slate-800 transition shadow-lg"
    >
      Return to Dashboard
    </button>
  </div>
);

// --- MAIN APP COMPONENT ---

const getInitialWizardData = () => ({
  source: '', 
  surveyMode: 'B2B', 
  mapLat: 36.8460, 
  mapLng: -76.2881,
  mapRadius: 1,
  creativeType: 'upload',
  cadence: 'single'
});

const steps = [
  { id: 'profile', title: 'Profile', component: WizardStepProfile },
  { id: 'source', title: 'Source', component: WizardStepSource },
  { id: 'upload', title: 'Upload List', component: WizardStepUpload },
  { id: 'segments', title: 'Segments', component: WizardStepSurvey },
  { id: 'map', title: 'Map', component: WizardStepMap },
  { id: 'creative', title: 'Creative', component: WizardStepCreative },
  { id: 'cadence', title: 'Cadence', component: WizardStepCadence },
  { id: 'review', title: 'Review', component: WizardStepReview }
];

const App = () => {
  // State
  const [user, setUser] = useState(null);
  const [view, setView] = useState('home'); // 'home', 'wizard', etc.
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [pendingWizardStepId, setPendingWizardStepId] = useState(null);

  // Wizard Data State
  const [wizardData, setWizardData] = useState(getInitialWizardData());

  // Auth & Init
  useEffect(() => {
    const initAuth = async () => {
      if (typeof window !== 'undefined' && window.__initial_auth_token) {
        await signInWithCustomToken(auth, window.__initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  // Wizard Helpers
  const updateWizardData = (newData) => {
    setWizardData(prev => ({ ...prev, ...newData }));
  };

  const openWizard = ({ reset = false, source, jumpToStepId } = {}) => {
    setSubmitSuccess(false);
    setIsSubmitting(false);
    setCurrentStep(0);
    setPendingWizardStepId(jumpToStepId || null);
    if (reset) {
      setWizardData(getInitialWizardData());
    }
    if (typeof source !== 'undefined') {
      setWizardData(prev => ({ ...prev, source }));
    }
    setView('wizard');
  };

  const navigate = (nextView) => {
    if (nextView === 'wizard') {
      openWizard({ reset: true });
      return;
    }
    setView(nextView);
  };


  // Logic to determine if we skip steps
  const activeSteps = useMemo(() => {
    const baseSteps = steps.filter(s => ['profile', 'source'].includes(s.id));
    const endSteps = steps.filter(s => ['creative', 'cadence', 'review'].includes(s.id));
    
    let midSteps = [];
    if (wizardData.source === 'upload') {
      midSteps = steps.filter(s => s.id === 'upload');
    } else if (wizardData.source === 'eddm') {
      midSteps = steps.filter(s => s.id === 'map');
    } else {
      // Default to Survey path (Segments + Map) if survey or empty
      midSteps = steps.filter(s => ['segments', 'map'].includes(s.id));
    }
    
    return [...baseSteps, ...midSteps, ...endSteps];
  }, [wizardData.source]);

  useEffect(() => {
    if (view !== 'wizard') return;
    if (!pendingWizardStepId) return;
    const idx = activeSteps.findIndex(s => s.id === pendingWizardStepId);
    if (idx < 0) return;
    setCurrentStep(idx);
    setPendingWizardStepId(null);
  }, [view, pendingWizardStepId, activeSteps]);

  const handleNext = async () => {
    if (currentStep < activeSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Submit
      if (!user) return;

      if (wizardData.source === 'upload' && !wizardData.uploadedFile) {
        alert('Please select a file to upload.');
        return;
      }

      setIsSubmitting(true);
      try {
        const { uploadedFile, ...campaignData } = wizardData;
        const campaignRef = await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'campaigns'), {
          ...campaignData,
          createdAt: serverTimestamp(),
          status: 'submitted'
        });

        if (uploadedFile) {
          const path = `artifacts/${appId}/users/${user.uid}/campaigns/${campaignRef.id}/uploads/${uploadedFile.name}`;
          const fileRef = storageRef(storage, path);
          await uploadBytes(fileRef, uploadedFile);
          const downloadUrl = await getDownloadURL(fileRef);
          await updateDoc(campaignRef, {
            uploadedListFile: {
              name: uploadedFile.name,
              path,
              downloadUrl,
              contentType: uploadedFile.type || '',
              size: uploadedFile.size || 0
            }
          });
        }
        setSubmitSuccess(true);
      } catch (err) {
        console.error("Submission error", err);
        alert("Something went wrong. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    } else {
      setView('home');
    }
  };

  // --- RENDER VIEWS ---

  if (view === 'home') {
    return (
      <div className="min-h-screen bg-white font-sans text-slate-800">
        <Navigation activePage="home" navigate={navigate} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />
        
        {/* Hero */}
        <section className="relative pt-12 pb-20 px-4 overflow-hidden">
          <div className="absolute inset-0 z-0 opacity-5 pointer-events-none bg-[url('https://img1.wsimg.com/isteam/ip/0815fdc9-aafc-4fe1-99f8-dedc9ba0e23b/blob-02576cc.png/:/rs=w:1440,h:1440')] bg-cover bg-center"></div>
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <h1 className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight mb-6">
              Precision Direct Mail—built around your <span className="text-blue-600">actual target segments.</span>
            </h1>
            <p className="text-xl text-slate-500 mb-10 max-w-2xl mx-auto">
              Stop mailing everyone. Reach the right prospects with custom messaging and smart follow-ups.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={() => openWizard({ reset: true })}
                className="bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
              >
                Start a Campaign <ChevronRight size={20} />
              </button>
              <button className="px-8 py-4 rounded-xl font-bold text-lg border-2 border-slate-200 hover:border-blue-200 hover:bg-blue-50 transition text-slate-600">
                Get Market Snapshot
              </button>
            </div>
            <div className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-400 font-medium">
              <CheckCircle2 size={16} className="text-green-500" /> Powered by analytics for 1,000+ businesses
            </div>
          </div>
        </section>

        {/* Tiles */}
        <section className="py-16 bg-slate-50 px-4">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center mb-6"><Upload /></div>
              <h3 className="text-xl font-bold mb-2">I have a list</h3>
              <p className="text-slate-500 mb-6 text-sm">Upload your existing CSV and we'll clean, segment, and route it for maximum impact.</p>
              <button onClick={() => openWizard({ source: 'upload', jumpToStepId: 'upload' })} className="text-indigo-600 font-bold text-sm flex items-center hover:gap-2 transition-all">Upload & Segment <ArrowRight size={16} className="ml-1" /></button>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-6"><Target /></div>
              <h3 className="text-xl font-bold mb-2">Help me define segments</h3>
              <p className="text-slate-500 mb-6 text-sm">Don't know who to target? Use our guided builder to find your perfect audience.</p>
              <button onClick={() => openWizard({ source: 'survey', jumpToStepId: 'segments' })} className="text-blue-600 font-bold text-sm flex items-center hover:gap-2 transition-all">Guided Builder <ArrowRight size={16} className="ml-1" /></button>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition">
              <div className="w-12 h-12 bg-teal-100 text-teal-600 rounded-lg flex items-center justify-center mb-6"><MapIcon /></div>
              <h3 className="text-xl font-bold mb-2">EDDM Route Coverage</h3>
              <p className="text-slate-500 mb-6 text-sm">Saturate specific neighborhoods or carrier routes with Every Door Direct Mail.</p>
              <button onClick={() => openWizard({ source: 'eddm', jumpToStepId: 'map' })} className="text-teal-600 font-bold text-sm flex items-center hover:gap-2 transition-all">Start Route Campaign <ArrowRight size={16} className="ml-1" /></button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 py-12 px-4">
           <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
             <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-slate-800 rounded flex items-center justify-center text-white text-xs font-bold">A</div>
                <span className="font-bold text-slate-800">AccelMail</span>
             </div>
             <p className="text-slate-400 text-sm">&copy; 2025 Accel Analysis. All rights reserved.</p>
           </div>
        </footer>
        
        {/* Sticky Mobile CTA */}
        <div className="md:hidden fixed bottom-4 left-4 right-4 z-40">
           <button 
             onClick={() => openWizard({ reset: true })}
             className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-xl shadow-blue-900/20"
            >
             Start Campaign
           </button>
        </div>
      </div>
    );
  }

  if (view === 'howitworks') {
    return (
      <PageShell
        title="How It Works"
        subtitle="A simple flow: define your audience, match message to segment, and launch precision mail with follow-ups."
        navigate={navigate}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
            <div className="font-bold text-slate-900">1. Choose a targeting path</div>
            <div className="mt-2 text-sm text-slate-600">Upload a list, build segments with the guided builder, or target EDDM routes.</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
            <div className="font-bold text-slate-900">2. Configure creative & cadence</div>
            <div className="mt-2 text-sm text-slate-600">Upload creative or request design, then choose a one-time or multi-touch sequence.</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
            <div className="font-bold text-slate-900">3. Submit & launch</div>
            <div className="mt-2 text-sm text-slate-600">We validate addresses, confirm final pricing, and begin production after approval.</div>
          </div>
        </div>
        <div className="mt-10">
          <button onClick={() => openWizard({ reset: true })} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition">
            Start a Campaign
          </button>
        </div>
      </PageShell>
    );
  }

  if (view === 'segments') {
    return (
      <PageShell
        title="Segments"
        subtitle="Define who you're targeting and tailor your message to the right audience."
        navigate={navigate}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      >
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
          <div className="text-sm text-slate-600">
            Use the guided builder to create segment definitions, or upload a list and let us segment it for you.
          </div>
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button onClick={() => openWizard({ source: 'survey', jumpToStepId: 'segments' })} className="bg-blue-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-blue-700 transition">
              Open Guided Builder
            </button>
            <button onClick={() => openWizard({ source: 'upload', jumpToStepId: 'upload' })} className="bg-slate-900 text-white px-5 py-3 rounded-xl font-bold hover:bg-slate-800 transition">
              Upload a List
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  if (view === 'pricing') {
    return (
      <PageShell
        title="Pricing"
        subtitle="Estimated pricing is shown during review. Final pricing is confirmed after design review and address validation."
        navigate={navigate}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
            <div className="font-bold text-slate-900">What your estimate includes</div>
            <div className="mt-2 text-sm text-slate-600">Printing, postage, and basic processing. Optional design services may apply.</div>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
            <div className="font-bold text-slate-900">Get an estimate</div>
            <div className="mt-2 text-sm text-slate-600">Run through the wizard to see an estimated total on the review step.</div>
            <div className="mt-6">
              <button onClick={() => openWizard({ reset: true, jumpToStepId: 'review' })} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition">
                View Estimate
              </button>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  if (view === 'about') {
    return (
      <PageShell
        title="About"
        subtitle="AccelMail helps local businesses run smarter direct-mail campaigns using analytics-driven segmentation."
        navigate={navigate}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      >
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
          <div className="text-sm text-slate-600">
            We combine targeting strategy, creative coordination, and operational execution so you can launch direct mail with confidence.
          </div>
          <div className="mt-6">
            <button onClick={() => openWizard({ reset: true })} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 transition">
              Start My Campaign
            </button>
          </div>
        </div>
      </PageShell>
    );
  }

  if (view !== 'wizard') {
    return (
      <PageShell
        title="Page not found"
        subtitle="This page doesn't exist yet."
        navigate={navigate}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      >
        <button onClick={() => setView('home')} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 transition">
          Go to Home
        </button>
      </PageShell>
    );
  }

  // WIZARD VIEW
  const CurrentStepComponent = activeSteps[currentStep].component;

  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-xl w-full p-2 rounded-2xl shadow-xl border border-slate-200">
           <WizardStepSuccess onReset={() => { setSubmitSuccess(false); setView('home'); setCurrentStep(0); }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Wizard Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button onClick={handleBack} className="text-slate-500 hover:text-slate-800 p-2 -ml-2">
            <ChevronLeft />
          </button>
          <div className="text-sm font-medium text-slate-500">
            Step {currentStep + 1} of {activeSteps.length}
          </div>
          <div className="w-8" /> {/* Spacer */}
        </div>
        {/* Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-100">
          <div 
            className="h-full bg-blue-600 transition-all duration-300" 
            style={{ width: `${((currentStep + 1) / activeSteps.length) * 100}%` }} 
          />
        </div>
      </header>

      {/* Wizard Body */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-4 md:p-8 pb-32">
          <CurrentStepComponent 
            data={wizardData} 
            updateData={updateWizardData} 
            isSubmitting={isSubmitting}
          />
        </div>
      </main>

      {/* Sticky Footer Actions */}
      <div className="bg-white border-t border-slate-200 p-4 sticky bottom-0 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <div className="max-w-2xl mx-auto flex gap-4">
           {/* Price Hint (only on Review) */}
           {activeSteps[currentStep].id !== 'review' && (
              <div className="hidden md:block flex-1"></div>
           )}
           
           <button 
             onClick={handleNext}
             disabled={isSubmitting}
             className="flex-1 bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-700 transition disabled:opacity-70 flex items-center justify-center gap-2"
           >
             {isSubmitting ? (
               'Processing...'
             ) : currentStep === activeSteps.length - 1 ? (
               'Submit Campaign Request'
             ) : (
               <>Next Step <ChevronRight size={20} /></>
             )}
           </button>
        </div>
      </div>
    </div>
  );
};

export default App;