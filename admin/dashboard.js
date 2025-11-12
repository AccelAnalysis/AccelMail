document.addEventListener('DOMContentLoaded', () => {
  const scriptUrl = '../scripts/config.js'.SCRIPT_URL; // Adjust import if needed

  // Fetch and populate pricing table
  fetch(scriptUrl + '?route=pricing')
    .then(res => res.json())
    .then(data => {
      const tableBody = document.getElementById('pricingTable').querySelector('tbody');
      data.mailerSizes.forEach(size => {
        size.pricing.forEach(tier => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${size.name}</td>
            <td contenteditable>${tier.range}</td>
            <td contenteditable>${tier.rate}</td>
            <td contenteditable>${tier.invoice}</td>
            <td><button class="delete">Delete</button></td>
          `;
          tableBody.appendChild(row);
        });
      });
    });

  // Save pricing
  document.getElementById('savePricing').addEventListener('click', () => {
    // Collect table data, post to backend with action=updateSettings
    fetch(scriptUrl, {
      method: 'POST',
      body: new FormData(/* collect form */)
    });
    alert('Pricing saved!');
  });

  // Similar for blackouts: add to list, save array
  // Fetch quotes, etc.
});