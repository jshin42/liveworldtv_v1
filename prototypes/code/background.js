// Critical test: Can we capture YouTube embed audio via tabCapture?
chrome.action.onClicked.addListener(async (tab) => {
  try {
    console.log('Testing tabCapture on tab:', tab.url)
    
    // Test 1: Does tabCapture work with YouTube embeds?
    const stream = await chrome.tabCapture.capture({
      audio: true,
      video: false
    })
    
    if (stream) {
      console.log('✅ tabCapture successful - stream obtained')
      
      // Test 2: Can we access audio tracks?
      const audioTracks = stream.getAudioTracks()
      console.log(`✅ Audio tracks: ${audioTracks.length}`)
      
      // Test 3: Basic Web Audio setup
      const audioContext = new AudioContext()
      const mediaStreamSource = audioContext.createMediaStreamSource(stream)
      console.log('✅ Web Audio context created')
      
      // Test 4: Latency measurement
      const startTime = performance.now()
      
      // Simulate processing delay
      setTimeout(() => {
        const endTime = performance.now()
        console.log(`⏱️ Basic processing latency: ${endTime - startTime}ms`)
        
        // Cleanup
        stream.getTracks().forEach(track => track.stop())
        audioContext.close()
      }, 100)
      
    } else {
      console.log('❌ tabCapture failed - no stream')
    }
    
  } catch (error) {
    console.error('❌ tabCapture error:', error)
    
    // Log specific error types for analysis
    if (error.name === 'NotAllowedError') {
      console.error('Permission denied - user needs to allow tab capture')
    } else if (error.name === 'NotSupportedError') {
      console.error('tabCapture not supported in this context')
    }
  }
})