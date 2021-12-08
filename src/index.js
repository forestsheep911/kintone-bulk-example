import './app.css'

kintone.events.on('app.record.index.show', (event) => {
  const myContainer = kintone.app.getHeaderSpaceElement()
  myContainer.innerHTML = '<div class="app"><h1>Hello, kintone!</h1></div>'
  return event
})
