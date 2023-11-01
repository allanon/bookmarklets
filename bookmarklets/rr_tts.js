// RoyalRoad-specific TTS. This will read the current page, then automatically load the next page and keep reading.

let tts_iterator = null;
let utterance = null;
function speak(cb) {
  let text = tts_iterator.next();
  let elems = tts_iterator.elems;
  let $curr = ttsQuery('.speaking'), cy = ($curr.offset() || {}).top, ch = $curr.height();
  let $next = ttsQuery(elems), ny = ($next.offset() || {}).top, nh = $next.height();
  $curr.removeClass('speaking');
  $next.addClass('speaking');
  if (cy && cy < ny && ny - cy + nh < ttsQuery(window).height()) {
    ttsQuery(window).scrollTop(cy - 2);
  } else {
    ttsQuery(window).scrollTop(ny - 2);
  }
  let u = (utterance = new SpeechSynthesisUtterance());
  if (text) {
    u.text = text;
    u.onend = function (event) {
      // Cancel+speak will cause the canceled utterance's onend to trigger. Ensure that doesn't cause us to attempt to speak the next line.
      if (utterance != u) return;
      speak(cb);
    };
  } else {
    if (cb) return cb();
    u.text = 'End of document.';
  }
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}
let init = cb => {
  let loaded = 0;
  function onload() {
    if (++loaded < 2) return;
    window.ttsQuery = window.jQuery;
    $.noConflict(true);
    ttsQuery(document.body).on('click', 'p,div', function (event) {
      if (event['tts']) return;
      event.tts = 1;
      if (ttsQuery(event.target).closest('.speaking').length) {
        tts_iterator.stop();
        utterance = null;
        speechSynthesis.cancel();
        ttsQuery('.speaking').removeClass('speaking');
        return;
      }
      tts_iterator = new TtsDomIterator($('.chapter-inner')[0], event.target);
      speak(_ => loadNextPage(_ => speakPage()));
    });
  }
  let s = document.createElement('style');
  s.type = 'text/css';
  s.innerHTML = '.speaking { outline: 3px solid #cc0; position: relative; }';
  document.getElementsByTagName('head')[0].appendChild(s);
  s = document.createElement('script');
  s.setAttribute('src', 'https://ajax.googleapis.com/ajax/libs/jquery/3.1.1/jquery.min.js');
  s.onload = onload;
  document.body.appendChild(s);
  s = document.createElement('script');
  s.setAttribute('src', 'https://allanon.github.io/bookmarklets/js/tts_dom_iterator.js');
  s.onload = onload;
  document.body.appendChild(s);
};
let loadNextPage = cb => {
  $.get($('a:contains(Next Chapter)').attr('href'), html => {
    let elems = new DOMParser().parseFromString(html, 'text/html');
    let body = elems.getElementsByTagName('body')[0];
    for (elem of [...document.body.children]) { elem.remove(); }
    for (elem of [...body.children]) { document.body.appendChild(elem); }
    if (cb) cb();
  });
};
let speakPage = cb => {
  tts_iterator = new TtsDomIterator($('.chapter-inner')[0], $('.chapter-inner').children()[0]);
  speak(_ => loadNextPage(_ => speakPage()));
};
init();
