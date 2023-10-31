// Provide a simple iterator interface given a DOM element which encloses all readable elements and a start element.
// Example 1
//   var i = TtsDomIterator('#text_to_speak');
//   i.current(); // returns ''
//   n = i.next(); // returns non-blank string, containing first paragraph
//   c = i.current(); // i == c
//   n = i.next(); // returns second paragraph
// Example 2
//   var i = TtsDomIterator('#text_to_speak');
//   for (var text = i.next() ; text ; text = i.next()) {
//     console.log(text);
//   }
// Example 3
//   var tts_iterator = null;
//   $('#content').on('click', 'p', function(event){
//     tts_iterator = new TtsDomIterator('#content', event.target);
//   });
//
//   function speak() {
//     var text = tts_iterator.next();
//     var elems = tts_iterator.elems;
//
//     $('.speaking').removeClass('speaking');
//     $(elems).addClass('speaking');
//
//     var u = new SpeechSynthesisUtterance();
//     if (text) {
//       u.text = text;
//       u.onend = function(event){ next(); };
//     } else {
//       u.text = 'End of document.';
//     }
//     speechSynthesis.cancel();
//     speechSynthesis.speak(u);
//   }

// Requires jQuery.
// TODO: Load jQuery if it's not already loaded?
window.ttsQuery = window['ttsQuery'] || window['jQuery'] || window['$'];

var TtsDomIterator = function(enclosing_elem, first_elem){
  var self = this;

  var elems = [];

  self.is_inline = function(elem) {
    if (!elem) return false;
    if (elem.nodeType == 3) return true; // text node
    if (elem.nodeName == 'BR') return false;
    var display = ttsQuery(elem).css('display');
    if (display == 'block') return false;
    if (display == 'list-item') return false;
    if (display == 'table-cell') return false;
    return true;
  };

  // Assumption: The currNode() is pointing at the next node to read.
  // After calling, this.text will contain the text to read, and currNode() will once again be pointing at the next node to read.
  self.forwardToBoundary = _ => {
    if (!this.iterator) return this;

    let node = this.currNode();
    let parent = node;

    // Handle the "past the end of the document" case.
    if (!node) {
      this.text = '';
      this.elems = [];
      return this;
    }

    this.text = '';

    var safety = 70;
    while (this.text == '' && node) {
      if (safety-- <= 0) { console.log('infinite loop detected! (1)'); break; }

      // If this element isn't a child, make it the new parent.
      if (!parent.contains(node)) parent = node;

      // Move forward to the next boundary, collecting all text elements along the way.
      while (this.is_inline(node = this.nextNode())) {
        if (safety-- <= 0) { console.log('infinite loop detected! (2)'); break; }

        if (node.nodeType == 3) this.text += node.data;
      }

      // Compress spaces.
      this.text = this.text.replace(/\s+/g, ' ').trim();
    }

    this.elems = [parent];

    return this;
  };

  var skip = null;
  self.readable = function(elem) {
// TODO: Check how expensive this is.
    var e = elem.nodeType == 1 ? elem : elem.parentElement;
    if (e.nodeType == 1 && ttsQuery(e).is(':hidden')) return false;
    // aria-hidden=true hides from screen readers (like this one) but is still visible. https://www.w3.org/TR/wai-aria/states_and_properties#aria-hidden
    if (elem.nodeType == 1 && elem.getAttribute('aria-hidden') == 'true') skip = elem;
    if (skip && elem.previousSibling == skip) skip = null;
    if (skip) return false;
    return true;
  };

  self.texts = [];
  self.texts.max = 100;
  self.texts.preload = 37;
  self.texts.idx = -1;
  self.current = _ => {
    this.elems = this.texts[this.texts.idx].elems;
    this.endOfDocument = this.elems.length == 0;
    return this.text = this.texts[this.texts.idx].text;
  }

  self.prev = _ => {
    if (this.texts.idx <= 0) {
      if (console.error) console.error('TtsDomIterator', 'tried to reverse past beginning of stored texts');
      return;
    }
    this.texts.idx--;
    return this.current();
  };

  // Avoid interaction with the DOM most of the time, for performance reasons.
  self.next = _ => {
    // Expand cache.
    if (this.texts.idx + 1 >= this.texts.length) {
      while (this.texts.idx + 1 + this.texts.preload >= this.texts.length) {
        this.forwardToBoundary();
        this.texts.push({text: this.text, elems: this.elems});
      }
    }

    this.texts.idx++;

    // Remove excess cache.
    let excess = this.texts.length - this.texts.max;
    if (excess > 0) {
      this.texts.idx -= excess;
      this.texts.splice(0, excess);
    }

    return self.current();
  };

  self.nodeMax = 100;
  self.nodeIdx = -1;
  self.lastNodeFound = 0;
  self.nodes = [];
  self.currNode = _ => this.nodes[this.nodeIdx];
  self.prevNode = _ => {
    if (this.nodeIdx <= 0) {
      if (console.error) console.error('TtsDomIterator', 'tried to reverse past beginning of stored nodes');
      return;
    }
    this.nodeIdx--;
    return this.currNode();
  };
  self.nextNode = _ => {
    if (this.lastNodeFound && this.nodeIdx > this.nodes.length) return this.currNode();

    while (!this.lastNodeFound && this.nodeIdx + 1 >= this.nodes.length) {
      let next = this.iterator.nextNode();
      if (next == null) {
        this.lastNodeFound = 1;
      } else {
        this.nodes.push(next);
      }
    }
    this.nodeIdx++;
    if (this.nodes.length > this.nodeMax) {
      this.nodeIdx -= this.nodes.length - this.nodeMax;
      this.nodes.splice(0, this.nodes.length - this.nodeMax);
    }
    return this.currNode();
  };

  self.stop = function(){
    self.text = '';
    self.iterator = null;
  };

  self.logIt = function(msg) {
    let now = new Date();
    let nowWithMs = now.toLocaleString().replace(/( [AP]M)/, '.'+now.getMilliseconds().toString().padEnd(3,'0')+'$1');
    console.log.apply(console, [nowWithMs].concat(Array.from(arguments)));
  };

  self.reset = first_elem => {
    // Select "element" (1) and "text" (4) type nodes.
    self.iterator = document.createNodeIterator(ttsQuery(enclosing_elem)[0], 4 + 1, self.readable);

    // Initial state: self.current() returns ''.
    self.text = '';

    // Fast-forward to the selected element.
    if (first_elem) {
      first_elem = ttsQuery(first_elem)[0];
      var node = this.nextNode();
      while (node && node != first_elem) {
        node = this.nextNode();
      }
    }
  };

  this.reset(first_elem);
}

TtsDomIterator.test = function(){
  function assert(f, msg) {
    var val;
    try {
      val = f();
      if (val) return;
      console.log('Test failed: ' + (msg || f));
    } catch(e) {
      console.log('Test threw exception: ' + (msg || f) + '\nException: '+e);
    }
    throw 'test failed';
  }

  try {
    var i = new TtsDomIterator(null);
    assert(function(){ return new TtsDomIterator(null).current() === undefined });
    assert(function(){ return new TtsDomIterator(null).next() === undefined });
    assert(function(){ return new TtsDomIterator('#book_content').current().length == 1 });
    assert(function(){ var e = new TtsDomIterator('#book_content').next(); return e && e.length == 1 });
    assert(function(){ return true });
    assert(function(){ return true });
    assert(function(){ return true });
    assert(function(){ return true });
    assert(function(){ return true });
    assert(function(){ return true });
    assert(function(){ return true });
    assert(function(){ return true });
    assert(function(){ return true });
    assert(function(){ return false });
  } catch (e) {
  }
};
