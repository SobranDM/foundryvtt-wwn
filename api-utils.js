const axios = require('axios');

/**
 * Fetches data from multiple endpoints and combines the results
 * @param {Array<string>} urls - Array of URLs to fetch from
 * @returns {Promise<Object>} Combined data from all successful requests
 */
async function fetchMultipleEndpoints(urls) {
  // Create an array of axios promises
  const promises = urls.map(url => axios.get(url));

  // Use Promise.allSettled to handle all promises, regardless of success/failure
  const results = await Promise.allSettled(promises);

  // Process the results
  const combinedData = {
    successful: [],
    failed: [],
    allData: {}
  };

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      // Successful request
      combinedData.successful.push({
        url: urls[index],
        data: result.value.data
      });
      combinedData.allData[urls[index]] = result.value.data;
    } else {
      // Failed request
      combinedData.failed.push({
        url: urls[index],
        error: result.reason.message
      });
      combinedData.allData[urls[index]] = null;
    }
  });

  return combinedData;
}

// Example usage:
async function example() {
  const urls = [
    'https://api.example.com/users',
    'https://api.example.com/posts'
  ];

  try {
    const result = await fetchMultipleEndpoints(urls);
    console.log('Successful requests:', result.successful);
    console.log('Failed requests:', result.failed);
    console.log('Combined data:', result.allData);
  } catch (error) {
    console.error('Error in example:', error);
  }
}

module.exports = {
  fetchMultipleEndpoints
}; 