// scripts/ui.js
import { CONFIG } from './config.js';

let currentStep = 1;
const totalSteps = 6;

// Store form data
const formData = {
  customerInfo: {},
  calculator: {},
  design: {},
  list: {},
  schedule: {}
};

document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('wizardModal');
  const startBtn = document.getElementById('startWizardBtn');
  const closeBtn = document.getElementById('closeWizardBtn');
  const progressBar = document.getElementById('progressBar');
  const stepIndicators = document.querySelectorAll('.step-indicator');
  const steps = document.querySelectorAll('.wizard-step');
  
  // Navigation buttons
  const nextToCalculatorBtn = document.getElementById('nextToCalculatorBtn');
  const nextToDesignBtn = document.getElementById('nextToDesignBtn');
  const backToCalculatorBtn = document.getElementById('backToCalculatorBtn');
  const nextToListBtn = document.getElementById('nextToListBtn');
  const backToDesignBtn = document.getElementById('backToDesignBtn');
  const nextToScheduleBtn = document.getElementById('nextToScheduleBtn');
  const backToListBtn = document.getElementById('backToListBtn');
  const nextToCheckoutBtn = document.getElementById('nextToCheckoutBtn');
  const backToScheduleBtn = document.getElementById('backToScheduleBtn');
  const submitOrderBtn = document.getElementById('submitOrderBtn');

  // Open wizard
  startBtn.addEventListener('click', (e) => {
    e.preventDefault();
    modal.style.display = 'flex';
    currentStep = 1;
    updateWizard();
    fetchConfig();
  });

  // Close wizard
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // Close on outside click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.style.display = 'none';
    }
  });

  // Navigation - with null checks and form validation
  const setupButton = (button, step, validateForm = null) => {
    if (button) {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Validate form if validation function is provided
        if (validateForm && !validateForm()) {
          return; // Don't proceed if validation fails
        }
        
        // Save form data before navigating
        saveFormData(currentStep);
        
        // Proceed to the next step
        goToStep(step);
      });
    }
  };

  // Setup navigation with validation
  setupButton(nextToCalculatorBtn, 2, validateCustomerInfo);
  setupButton(nextToDesignBtn, 3, validateCalculator);
  setupButton(backToCalculatorBtn, 2);
  setupButton(nextToListBtn, 4, validateDesign);
  setupButton(backToDesignBtn, 3);
  setupButton(nextToScheduleBtn, 5, validateList);
  setupButton(backToListBtn, 4);
  setupButton(nextToCheckoutBtn, 6, validateSchedule);
  setupButton(backToScheduleBtn, 5);

  // Submit with form data
  if (submitOrderBtn) {
    submitOrderBtn.addEventListener('click', (e) => {
      e.preventDefault();
      submitOrder();
    });
  }

  // Quantity selection
  document.querySelectorAll('.quantity-options button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.quantity-options button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateCosts();
      updateSubmitButton();
    });
  });

  // Design toggle
  document.querySelectorAll('input[name="designOption"]').forEach(opt => {
    opt.addEventListener('change', () => {
      const upload = document.getElementById('uploadArtworkFields');
      const request = document.getElementById('requestDesignFields');
      if (opt.value === 'upload') {
        upload.style.display = 'block';
        request.style.display = 'none';
      } else {
        upload.style.display = 'none';
        request.style.display = 'block';
      }
    });
  });

  function goToStep(step) {
    if (step < 1 || step > totalSteps) return;
    currentStep = step;
    updateWizard();
    if (step === 5) populateSummary();
  }

  function updateWizard() {
    // Update progress
    progressBar.style.width = `${(currentStep / totalSteps) * 100}%`;
    
    // Update steps
    steps.forEach((s, i) => {
      s.classList.toggle('active', i + 1 === currentStep);
    });
    
    // Update indicators
    stepIndicators.forEach((ind, i) => {
      ind.classList.toggle('active', i + 1 <= currentStep);
    });
  }

  function fetchConfig() {
    // Fallback config in case the fetch fails
    const fallbackConfig = {
      mailerSizes: [
        { name: 'Postcard (4.25" x 6")' },
        { name: 'Letter (8.5" x 11")' },
        { name: 'Flyer (8.5" x 11" tri-fold)' }
      ],
      designFee: 99
    };

    try {
      fetch(CONFIG.SCRIPT_URL + '?route=config')
        .then(res => res.ok ? res.json() : fallbackConfig)
        .then(config => {
          // Populate mailer sizes
          const select = document.getElementById('mailer-size');
          if (select) {
            select.innerHTML = '<option value="">Select size</option>' + 
              (config.mailerSizes || fallbackConfig.mailerSizes)
                .map(s => `<option value="${s.name}">${s.name}</option>`)
                .join('');
          }
          
          // Update design fee if element exists
          const designFeeEl = document.getElementById('designFee');
          if (designFeeEl) {
            designFeeEl.innerHTML = `$${config.designFee || fallbackConfig.designFee} <span class="text-muted">(one-time)</span>`;
          }
          
          window.blackoutDates = config.blackoutDates || [];
        })
        .catch(() => {
          // If fetch fails, use fallback config
          const select = document.getElementById('mailer-size');
          if (select) {
            select.innerHTML = '<option value="">Select size</option>' + 
              fallbackConfig.mailerSizes.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
          }
        });
    } catch (error) {
      console.error('Error loading config:', error);
    }
  }

  function updateCosts() {
    const sizeSelect = document.getElementById('mailer-size');
    const rangeBtn = document.querySelector('.quantity-options button.active');
    const perPieceEl = document.getElementById('perPieceCost');
    const totalCostEl = document.getElementById('totalCost');
    
    if (!sizeSelect || !rangeBtn || !perPieceEl || !totalCostEl) return;
    
    const size = sizeSelect.value;
    const range = rangeBtn.dataset.range;
    
    if (!size || !range) {
      perPieceEl.textContent = '$0.00';
      totalCostEl.textContent = '$0.00';
      return;
    }
    
    // Get pricing from config
    const perPiece = CONFIG.PRICING[size]?.[range] || 0;
    const qty = range === '2000+' ? 2000 : parseInt(range.split('-')[0]);
    const total = (perPiece * qty).toFixed(2);
    
    perPieceEl.textContent = `$${perPiece.toFixed(2)}`;
    totalCostEl.textContent = `$${total}`;
  }

  function updateSubmitButton() {
    const range = document.querySelector('.quantity-options button.active')?.dataset.range;
    const text = document.getElementById('submitText');
    if (range === '2000+') {
      text.textContent = 'Request Quote';
    } else {
      text.textContent = 'Pay Now';
    }
  }

  // Form validation functions
  function validateCustomerInfo() {
    const form = document.getElementById('customerInfoForm');
    if (!form) return true; // Skip validation if form doesn't exist
    
    if (!form.checkValidity()) {
      form.reportValidity();
      return false;
    }
    return true;
  }
  
  function validateCalculator() {
    const form = document.getElementById('calculatorForm');
    if (!form) return true;
    
    if (!form.checkValidity()) {
      form.reportValidity();
      return false;
    }
    return true;
  }
  
  function validateDesign() {
    const form = document.getElementById('designForm');
    if (!form) return true;
    
    if (!form.checkValidity()) {
      form.reportValidity();
      return false;
    }
    return true;
  }
  
  function validateList() {
    const form = document.getElementById('listForm');
    if (!form) return true;
    
    if (!form.checkValidity()) {
      form.reportValidity();
      return false;
    }
    return true;
  }
  
  function validateSchedule() {
    const form = document.getElementById('scheduleForm');
    if (!form) return true;
    
    if (!form.checkValidity()) {
      form.reportValidity();
      return false;
    }
    return true;
  }
  
  // Save form data when navigating between steps
  function saveFormData(step) {
    let form;
    switch(step) {
      case 1:
        form = document.getElementById('customerInfoForm');
        if (form) {
          const formDataObj = new FormData(form);
          formData.customerInfo = Object.fromEntries(formDataObj.entries());
        }
        break;
      case 2:
        form = document.getElementById('calculatorForm');
        if (form) {
          const formDataObj = new FormData(form);
          formData.calculator = Object.fromEntries(formDataObj.entries());
          formData.calculator.quantity = document.querySelector('.quantity-options button.active')?.dataset.range;
        }
        break;
      // Add other cases for other steps if needed
    }
  }
  
  function populateSummary() {
    const summary = document.getElementById('checkoutSummary');
    if (!summary) return;
    
    let html = '';
    
    // Add customer info to summary
    if (formData.customerInfo) {
      html += `
        <li class="summary-item">
          <span class="summary-label">Business:</span>
          <span class="summary-value">${formData.customerInfo.businessName || 'Not provided'}</span>
        </li>
        <li class="summary-item">
          <span class="summary-label">Contact:</span>
          <span class="summary-value">${formData.customerInfo.contactFirstName || ''} ${formData.customerInfo.contactLastName || ''}</span>
        </li>
        <li class="summary-item">
          <span class="summary-label">Email:</span>
          <span class="summary-value">${formData.customerInfo.email || 'Not provided'}</span>
        </li>
        <li class="summary-item">
          <span class="summary-label">Phone:</span>
          <span class="summary-value">${formData.customerInfo.phone || 'Not provided'}</span>
        </li>
        <li class="summary-item">
          <span class="summary-label">Address:</span>
          <span class="summary-value">
            ${formData.customerInfo.address || ''}<br>
            ${formData.customerInfo.city || ''}, ${formData.customerInfo.state || ''} ${formData.customerInfo.zip || ''}
          </span>
        </li>
        <li class="summary-divider"></li>
      `;
    }
    
    // Gather data
    const size = document.getElementById('mailer-size').value;
    const range = document.querySelector('.quantity-options button.active')?.textContent || 'Not selected';
    const budget = document.getElementById('budget').value;
    const designOption = document.querySelector('input[name="designOption"]:checked').parentElement.querySelector('.toggle-label').textContent;
    const date = document.getElementById('mailDate').value;
    
    html += `<li><strong>Mailer Size:</strong> ${size || 'Not selected'}</li>`;
    html += `<li><strong>Quantity:</strong> ${range}</li>`;
    if (budget) html += `<li><strong>Budget:</strong> $${budget}</li>`;
    html += `<li><strong>Design:</strong> ${designOption}</li>`;
    html += `<li><strong>Mail Date:</strong> ${date || 'Not selected'}</li>`;
    
    summary.innerHTML = html;
  }

  async function submitOrder() {
    const formData = new FormData();
    const range = document.querySelector('.quantity-options button.active')?.dataset.range;
    const isQuote = range === '2000+';
    
    // Collect all form data
    document.querySelectorAll('.wizard-form input, .wizard-form select, .wizard-form textarea').forEach(input => {
      if (input.type === 'file' && input.files[0]) {
        formData.append(input.name, input.files[0]);
      } else if (input.type === 'checkbox') {
        formData.append(input.name, input.checked);
      } else if (input.value) {
        formData.append(input.name, input.value);
      }
    });
    
    formData.append('action', isQuote ? 'quoteRequest' : 'submitOrder');
    
    try {
      const res = await fetch(CONFIG.SCRIPT_URL, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (data.ok) {
        modal.style.display = 'none';
        alert(isQuote ? 'Quote request submitted!' : 'Order submitted! Redirecting to payment...');
        if (data.invoiceLink) window.location.href = data.invoiceLink;
      }
    } catch (err) {
      alert('Error submitting. Please try again.');
    }
  }

  // Initialize
  updateWizard();
});