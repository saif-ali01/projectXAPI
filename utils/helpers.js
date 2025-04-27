// utils/helpers.js
const isValidDate = (date) => {
    // Check if it's a Date object and not invalid
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      return false;
    }
    
    // Additional check for realistic date ranges (optional)
    const currentYear = new Date().getFullYear();
    if (date.getFullYear() < 2000 || date.getFullYear() > currentYear + 5) {
      return false;
    }
    
    return true;
  };
  
  module.exports = { isValidDate };