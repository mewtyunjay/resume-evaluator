import * as pdfjsLib from './lib/pdf.mjs';

// Set up PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.mjs';

document.addEventListener('DOMContentLoaded', function() {
    var fileInput = document.getElementById('fileInput');
    var uploadButton = document.getElementById('uploadButton');
    var contentDiv = document.getElementById('content');
    var setApiKeyButton = document.getElementById('setApiKeyButton');
    var deleteApiKeyButton = document.getElementById('deleteApiKeyButton');

    uploadButton.addEventListener('click', function() {
      fileInput.click();
    });
  
    fileInput.addEventListener('change', function(e) {
      var file = e.target.files[0];
      if (file && file.type === 'application/pdf') {
        readPdfContent(file);
      } else {
        contentDiv.textContent = 'Please select a PDF file.';
      }
      fileInput.value = '';
    });
  
    function readPdfContent(file) {
      var reader = new FileReader();
      reader.onload = function(event) {
        var arrayBuffer = event.target.result;
        // Use PDF.js to parse the PDF
        pdfjsLib.getDocument(arrayBuffer).promise.then(function(pdf) {
          var numPages = pdf.numPages;
          var pdfContent = '';
          
          function getPageText(pageNum) {
            return pdf.getPage(pageNum).then(function(page) {
              return page.getTextContent();
            }).then(function(textContent) {
              return textContent.items.map(function(item) {
                return item.str;
              }).join(' ');
            });
          }

          var promises = [];
          for (var i = 1; i <= numPages; i++) {
            promises.push(getPageText(i));
          }

          Promise.all(promises).then(function(pageTexts) {
            pdfContent = pageTexts.join('\n\n');
            summarizePdfContent(pdfContent, file.name, file.size);
          });
        }).catch(function(error) {
          console.error('Error parsing PDF:', error);
          contentDiv.textContent = `Error parsing PDF: ${error.message}`;
        });
      };
      reader.readAsArrayBuffer(file);
    }

    function summarizePdfContent(content, fileName, fileSize) {
      chrome.storage.sync.get(['openaiApiKey'], function(result) {
        if (!result.openaiApiKey) {
          contentDiv.textContent = 'OpenAI API key not set. Please set it first.';
          return;
        }

        fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${result.openaiApiKey}`
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [
              {"role": "system", "content": "You are a helpful assistant that summarizes text."},
              {"role": "user", "content": `Summarize the following text:\n${content}`}
            ]
          })
        })
        .then(response => response.json())
        .then(data => {
          if (data.choices && data.choices[0] && data.choices[0].message) {
            const summary = data.choices[0].message.content;
            contentDiv.textContent = `File Name: ${fileName}\nFile Size: ${fileSize} bytes\n\nSummary:\n${summary}`;
          } else {
            contentDiv.textContent = 'Error: Unexpected API response';
          }
        })
        .catch(error => {
          console.error('Error summarizing content:', error);
          contentDiv.textContent = `Error summarizing content: ${error.message}`;
        });
      });
    }

    setApiKeyButton.addEventListener('click', function() {
      const apiKey = prompt("Enter your OpenAI API key:");
      if (apiKey) {
        chrome.storage.sync.set({openaiApiKey: apiKey}, function() {
          console.log('API key saved');
          alert('API key saved successfully!');
        });
      }
    });

    deleteApiKeyButton.addEventListener('click', function() {
      if (confirm("Are you sure you want to delete your OpenAI API key?")) {
        chrome.storage.sync.remove('openaiApiKey', function() {
          console.log('API key deleted');
          alert('API key deleted successfully!');
        });
      }
    });
  });