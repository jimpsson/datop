var blessed = require('blessed')
var through = require('through2')
var xtend = require('xtend')
var dataChart = require('./chart.js')

module.exports = Screen

function Screen(host, theme) {
  if (!(this instanceof Screen)) return new Screen(host, theme)
  var self = this
  var opts = {}
  if (process.env.DEBUG) opts.log = './datop.log'
  var program = blessed.program(opts)
  
  process.on('SIGINT', function() {
    self.kill()
  })
  
  this.program = program
  this.host = host
  this.screen = blessed.screen()
  
  this.headerText = ' {bold}datop{/bold} - ' + host
  var header = blessed.text({
    top: 'top',
    left: 'left',
    width: this.headerText.length + 10,
    height: '1',
    fg: theme.title.fg,
    content: this.headerText,
    tags: true
  })
  
  this.screen.append(header)
  
  this.screen.on('resize', function() {
    for (var i = 0; i < self.renderList.length; i++) {
      var item = self.renderList[i]
      if (item.chart) {
        dataChart.resize(item.chart, item.box)
        updateHeader(item.chart)
      }
    }
  })
  
  this.theme = theme
  this.renderList = []
  
  setInterval(draw, 1000)
  
  function draw() {
    if (self.renderList.length === 0) return
    var updatedHeader = self.headerText
    for (var i = 0; i < self.renderList.length; i++) {
      var item = self.renderList[i]
      item.render()
      if (item.chart) updateHeader(item.chart)
    }
    header.content = updatedHeader
    self.screen.render()
  }
  
  function updateHeader(chart) {
    var min = ~~(chart.width / 60)
    var sec = chart.width % 60
    self.headerText = ' {bold}datop{/bold} - ' + self.host + ' - showing ' + min + 'm' + sec + 's'
  }
}

Screen.prototype.kill = function() {
  this.program.clear()
  this.program.disableMouse()
  this.program.showCursor()
  this.program.normalBuffer()
  this.process.exit(0)
}

Screen.prototype.createBox = function(opts) {
  var theme = this.theme
  var screen = this.screen
  if (!opts) opts = {}
  
  var defaults = {
    top: 1,
    left: 'left',
    width: '100%',
    height: '99%',
    content: '',
    fg: theme.chart.fg,
    tags: true,
    border: theme.chart.border
  }
  
  var box = blessed.box(xtend(defaults, opts))

  screen.append(box)
  screen.render()
  
  if (opts.title) box.setLabel(opts.title)
  
  return box
}

Screen.prototype.createChart = function(opts) {
  var self = this
  var box = this.createBox(opts)
  var chart = dataChart.create(box)
  var position = 0
  
  var stream = through.obj(
    function write(obj, enc, next) {
      chart.ready = true
      chart.value = obj
      next()
    },
    function end() {
      chart.ready = false
    }
  )
  
  stream.chart = chart
  stream.box = box
  
  stream.render = function() {
    if (process.env.DEBUG) self.program.log([chart.min, chart.max, chart.average, chart.values[chart.values.length - 1]])
    position++
    box.setContent(dataChart.draw(chart, position))
  }
  
  this.renderList.push(stream)
  
  return stream
}
