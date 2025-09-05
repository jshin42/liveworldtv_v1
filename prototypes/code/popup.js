document.getElementById('testTabCapture').addEventListener('click', async () => {
  const results = document.getElementById('results')
  const summary = document.getElementById('summary')
  
  try {
    // Test 1: Basic permission check
    updateResult(0, 'Testing permissions...', 'pending')
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    
    if (tab.url.includes('youtube.com')) {
      updateResult(0, '✅ YouTube tab detected', 'success')
    } else {
      updateResult(0, '⚠️ Not on YouTube - test with youtube.com', 'error')
      return
    }
    
    // Test 2: tabCapture attempt
    updateResult(1, 'Attempting tabCapture...', 'pending')
    
    chrome.runtime.sendMessage({ action: 'testCapture' }, (response) => {
      if (response.success) {
        updateResult(1, '✅ Audio capture successful', 'success')
        updateResult(2, `⏱️ Latency: ${response.latency}ms`, 'success')
        updateResult(3, `📊 Memory: ${response.memoryUsage}MB`, 'success')
        
        summary.innerHTML = `<div class="test-result success">
          <strong>Feasibility: VIABLE</strong><br>
          Core extension approach can work with YouTube embeds.
        </div>`
      } else {
        updateResult(1, `❌ Capture failed: ${response.error}`, 'error')
        summary.innerHTML = `<div class="test-result error">
          <strong>Feasibility: BLOCKED</strong><br>
          ${response.error}
        </div>`
      }
    })
    
  } catch (error) {
    updateResult(1, `❌ Extension error: ${error.message}`, 'error')
  }
})

function updateResult(index, message, type) {
  const results = document.querySelectorAll('.test-result')
  if (results[index]) {
    results[index].innerHTML = message
    results[index].className = `test-result ${type}`
  }
}