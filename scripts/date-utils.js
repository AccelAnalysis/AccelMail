// scripts/date-utils.js
document.addEventListener('DOMContentLoaded', () => {
  flatpickr('#mailDate', {
    dateFormat: 'Y-m-d',
    minDate: 'today',
    disable: [
      function(date) {
        if (date.getDay() !== 2) return true;
        return window.blackoutDates?.includes(date.toISOString().slice(0, 10));
      }
    ]
  });
});