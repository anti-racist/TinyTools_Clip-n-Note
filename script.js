document.addEventListener('DOMContentLoaded', function() {
  const NUM_URL_INPUTS = 5;

  function attachInputListeners() {
    for (let i = 1; i <= NUM_URL_INPUTS; i++) {
      const urlInput = document.getElementById('productUrl' + i);
      if (urlInput) {
        urlInput.addEventListener('input', function() {
          saveUrl(urlInput.value, i);
        });
      }
    }
  }

  function clearSavedUrls() {
    chrome.storage.sync.set({ savedUrls: [] }, loadSavedUrls);
  }

  function copySavedUrls() {
    chrome.storage.sync.get({ savedUrls: [] }, function(data) {
      const savedUrls = data.savedUrls;
      if (savedUrls.length > 0) {
        const allUrls = savedUrls.join('\n');
        navigator.clipboard.writeText(allUrls).then(function() {
          console.log('URLs copied to clipboard successfully.');
        }).catch(function(error) {
          console.error('Error copying URLs:', error);
        });
      }
    });
  }

  function loadSavedUrls() {
    chrome.storage.sync.get({ savedUrls: [] }, function(data) {
      const savedUrls = data.savedUrls;
      for (let i = 1; i <= NUM_URL_INPUTS; i++) {
        const urlInput = document.getElementById('productUrl' + i);
        urlInput.value = savedUrls[i - 1] || '';
      }
    });
  }

  function cleanUpUrl(url) {
    try {
      let cleanedUrl = new URL(url);

      // Example: Remove 'utm' parameters used for tracking
      let searchParams = cleanedUrl.searchParams;
      [...searchParams.keys()].forEach(key => {
        if (key.startsWith('utm_')) {
          searchParams.delete(key);
        }
      });

      // Reconstruct the URL without unnecessary parameters
      return cleanedUrl.origin + cleanedUrl.pathname + '?' + searchParams;
    } catch (error) {
      console.error('Invalid URL:', error);
      return url; // Return the original URL if there's an error
    }
  }

  function saveUrl(url, index) {
    const cleanedUrl = cleanUpUrl(url); // Clean the URL
    chrome.storage.sync.get({ savedUrls: [] }, function(data) {
      const savedUrls = data.savedUrls;
      savedUrls[index - 1] = cleanedUrl;
      chrome.storage.sync.set({ savedUrls: savedUrls }, loadSavedUrls);
    });
  }

  // Debounce function
  function debounce(func, wait) {
    let timeout;

    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };

      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  function loadSavedNotes() {
    const notes = document.getElementById('notePad');
    chrome.storage.sync.get({ savedNotes: '' }, function(data) {
      notes.value = data.savedNotes;
    });

    // Debounced save notes function
    const debouncedSaveNotes = debounce(function() {
      chrome.storage.sync.set({ savedNotes: notes.value });
    }, 500); // 500 milliseconds = 1/2 seconds

    notes.addEventListener('input', debouncedSaveNotes);
  }

  // Attach input listeners and load data
  attachInputListeners();
  loadSavedUrls();
  loadSavedNotes();

  // Attach event listeners for clear and copy actions
  document.getElementById('clearUrls').addEventListener('click', clearSavedUrls);
  document.getElementById('copyUrls').addEventListener('click', copySavedUrls);
});
