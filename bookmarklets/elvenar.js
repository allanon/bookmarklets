let Replay = function() {
  this.preset = 0;
  this.events = [];
  this._capturing = false;
  this._replaying = false;
  this.capture = val => {
    this._capturing = val;
    return this;
  };
  this.instrument = elem => {
    'mousedown mouseup mousemove'.split(' ').forEach(eventType =>
      elem.addEventListener(
        eventType,
        e => {
          if (!this._capturing) return;
          let event = {
            elem: elem,
            time: new Date().getTime(),
            type: eventType,
            opt: { pointerX: e.clientX, pointerY: e.clientY },
          };
          this.events.push(event);
          return true;
        },
        { capture: true, passive: true }
      )
    );
    return this;
  };
  this.simulate = (element, eventName, options) => {
    let eventMatchers = {
      HTMLEvents: /^(?:load|unload|abort|error|select|change|submit|reset|focus|blur|resize|scroll)$/,
      MouseEvents: /^(?:click|dblclick|mouse(?:down|up|over|move|out))$/,
    };
    let defaultOptions = {
      pointerX: 0,
      pointerY: 0,
      button: 0,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      bubbles: true,
      cancelable: true,
    };
    let o = Object.assign({}, defaultOptions, options || {});
    let eventType;
    for (let name in eventMatchers) {
      if (eventMatchers[name].test(eventName)) {
        eventType = name;
        break;
      }
    }
    let oEvent = document.createEvent(eventType);
    if (eventType == 'HTMLEvents') {
      oEvent.initEvent(eventName, o.bubbles, o.cancelable);
    } else {
      oEvent.initMouseEvent(
        eventName,
        o.bubbles,
        o.cancelable,
        document.defaultView,
        o.button,
        o.pointerX,
        o.pointerY,
        o.pointerX,
        o.pointerY,
        o.ctrlKey,
        o.altKey,
        o.shiftKey,
        o.metaKey,
        o.button,
        element
      );
    }
    element.dispatchEvent(oEvent);
    return this;
  };
  this.replay = (eventCb, completeCb) => {
    if (!this.events.length) return this;
    if (this._replaying) return this;
    this._replaying = true;
    if (this.events[0].time) {
      let t0 = this.events[0].time;
      this.events.forEach(event => (event.time = event.time - t0));
    }
    let t0 = new Date().getTime();
    let idx = 0;
    let play = _ => {
      if (!this._replaying) return;
      let event = this.events[idx];
      if (!event) return;
      if (eventCb) eventCb(event);
      this.simulate(event.elem, event.type, event.opt);
      idx++;
      let now = new Date().getTime();
      while (
        idx <= this.events.length - 1 &&
        this.events[idx].type == 'mousemove' &&
        t0 + this.events[idx].time <= now
      ) {
        console.log('skipping lagged event');
        idx++;
      }
      if (idx < this.events.length) {
        console.log(
          'next event',
          t0 + this.events[idx].time - now,
          this.events[idx]
        );
        setTimeout(play, Math.max(0, t0 + this.events[idx].time - now));
      } else {
        this._replaying = false;
        if (completeCb) completeCb();
      }
    };
    play();
    return this;
  };
  this.stop = _ => {
    this._capturing = false;
    this._replaying = false;
    return this;
  };
  this.reset = _ => {
    this.events = [];
    return this.stop();
  };
};
let Elvenar = function() {
  this.debug = 1;
  let canvas = document.getElementsByTagName('canvas')[0];
  if (!canvas) {
    this.debug = 2;
    window.scrollTo(0, 0);
    console.log('creating canvas');
    canvas = document.createElement('canvas');
    Object.assign(canvas.style, {
      position: 'absolute',
      left: '0px',
      top: '0px',
      width: '100%',
      height: '100%',
      background: 'rgba(255,0,0,0.7)',
    });
    document.body.append(canvas);
    'mousedown mouseup mousemove keydown'.split(' ').forEach(eventType =>
      canvas.addEventListener(
        eventType,
        e => {
          if (this.debug >= 3)
            console.log('event', {
              type: eventType,
              x: e.clientX,
              y: e.clientY,
            });
          return true;
        },
        { capture: true, passive: true }
      )
    );
  }
  let overlayDiv = (this.overlayDiv = document.createElement('div'));
  Object.assign(overlayDiv.style, {
    position: 'absolute',
    left: '0px',
    top: '0px',
    width: '100%',
    height: '100%',
    opacity: 0.7,
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: 9999,
  });
  document.body.append(overlayDiv);
  this.addToOverlay = styles => {
    let div = document.createElement('div');
    Object.assign(div.style, styles || {});
    overlayDiv.append(div);
    return div;
  };
  this.clearOverlay = _ => (overlayDiv.innerHTML = '');
  let replay = (this.replay =
    this.replay || new Replay().instrument(document.body));
  let mouseupdown = 'up';
  this.displayEvent = event => {
    if (event.type == 'mousedown') mouseupdown = 'down';
    if (event.type == 'mouseup') mouseupdown = 'up';
    let styles = { position: 'absolute' };
    if (event.type == 'mousemove') {
      Object.assign(styles, {
        left: `${event.opt.pointerX - 2}px`,
        top: `${event.opt.pointerY - 2}px`,
        width: `5px`,
        height: '5px',
        background: 'rgba(0,255,255,0.7)',
      });
      if (mouseupdown == 'down') {
        Object.assign(styles, { background: 'rgba(0,127,255,1)' });
      }
    } else {
      Object.assign(styles, {
        left: `${event.opt.pointerX - 5}px`,
        top: `${event.opt.pointerY - 5}px`,
        width: `11px`,
        height: '11px',
        borderRadius: '100%',
        background: 'blue',
      });
    }
    this.addToOverlay(styles);
  };
  this.show = _ => {
    this.replay.events.forEach(event => {
      if (!event.opt) return;
      if (!event.opt.pointerX) return;
      if (!event.opt.pointerY) return;
      this.displayEvent(event);
    });
  };
  this.stop = _ => {
    this.replay.stop();
    if (this.waitAndReplayTimeout) {
      clearTimeout(this.waitAndReplayTimeout);
      this.waitAndReplayTimeout = null;
    }
  };
  this.test = _ => {
    this.debug = 2;
    this.waitAndReplay();
  };
  this.waitAndReplay = _ => {
    this.clearOverlay();
    this.stop();
    this.addToOverlay({
      zIndex: 9999,
      position: 'absolute',
      left: `${this.replay.events[0].opt.pointerX - 6}px`,
      top: `${this.replay.events[0].opt.pointerY - 6}px`,
      width: '13px',
      height: '13px',
      boxSizing: 'border-box',
      border: '1px solid dashed',
      borderRadius: '100%',
      textAlign: 'center',
      opacity: 0.5,
      overflow: 'hidden',
      pointerEvents: 'none',
      background: 'blue',
      border: '3px solid white',
      outline: '3px solid blue',
    });
    let countdown = this.addToOverlay({
      zIndex: 9999,
      position: 'absolute',
      right: '10px',
      top: '10px',
      width: '100px',
      padding: '10px',
      boxSizing: 'border-box',
      border: '1px solid black',
      color: 'black',
      background: 'white',
      textAlign: 'center',
      opacity: 0.2,
      overflow: 'hidden',
      pointerEvents: 'none',
    });
    countdown.setAttribute('tabindex', -1);
    countdown.addEventListener('keydown', e => this.stop());
    let t0 = new Date().getTime();
    this.waitAndReplayTimeout = setInterval(_ => {
      let secondsRemaining = Math.floor(
        (this.interval * 60 * 1000 - (new Date().getTime() - t0)) / 1000
      );
      countdown.innerText = secondsRemaining;
      if (secondsRemaining <= 0) {
        clearTimeout(this.waitAndReplayTimeout);
        this.replayNow();
      }
    }, 1000);
  };
  this.replayNow = _ => {
    console.log('replaying!');
    this.clearOverlay();
    this.replay.replay(
      event => {
        if (this.debug >= 2) console.log('replay', event);
        if (this.debug && event.opt.pointerX && event.opt.pointerY)
          this.displayEvent(event);
      },
      _ => {
        this.clearOverlay();
        this.waitAndReplay();
      }
    );
  };
  this.asJson = _ => {
    return {
      interval: this.interval,
      events: this.replay.events.map(event =>
        Object.fromEntries(Object.entries(event).filter(e => e[0] != 'elem'))
      ),
    };
  };
  this.fromJson = json => {
    this.interval = json.interval;
    this.replay.events = json.events.map(event =>
      Object.assign({ elem: canvas }, event)
    );
  };
  this.save = n => {
    let item;
    try {
      item = JSON.parse(localStorage.getItem('ethanElvenar') || '{}');
    } catch (e) {
      item = {};
    }
    item.preset = this.preset || 0;
    item.saves = item.saves || [];
    item.saves[n] = item.saves[n] || {};
    item.saves[n].data = this.asJson();
    localStorage.setItem('ethanElvenar', JSON.stringify(item));
  };
  this.load = n => {
    let item;
    try {
      item = JSON.parse(localStorage.getItem('ethanElvenar') || '{}');
    } catch (e) {
      item = {};
    }
    if (n === undefined) n = this.preset = item.preset || 0;
    if (item && item.saves && item.saves[n] && item.saves[n].data) {
      this.fromJson(item.saves[n].data);
    }
  };
  this.reset = _ => {
    this.clearOverlay();
    this.stop();
    this.replay.reset();
    this.interval = prompt('How many minutes between replays?');
    alert(`Recording preset #${this.preset+1}.\nGet ready to perform actions.\nPress the Shift key to end recording.`);
    let signal = new AbortController();
    canvas.addEventListener(
      'keydown',
      e => {
        if (e.key != 'Shift') return;
        this.replay.capture(false);
        console.log(`event capture complete, captured [${this.replay.events.length}] events`);
        this.replay.events = this.replay.events.slice(this.replay.events.findIndex(e => e.type != 'mousemove') - 1);
        this.replay.events[0].time = this.replay.events[1].time - 800;
        this.replay.events.forEach(e => (e.elem = canvas));
        signal.abort();
        this.waitAndReplay();
      },
      { capture: true, passive: true, signal: signal.signal }
    );
    this.replay.capture(true);
  };
  canvas.setAttribute('tabindex', '-1');
  this.stop();
  this.load(this.preset);
  this.show();
  canvas.addEventListener('keydown', e => {
    if (0) window._ignored = 1;
    else if (e.key == ' ' && (this.waitAndReplayTimeout || this.replay._replaying)) console.log('stop', this.stop());
    else if (e.key == ' ') console.log('start', setTimeout(this.replayNow, 3000));
    else if (e.key == '>') console.log('save', this.save(this.preset));
    else if (e.key == '<') console.log('load', this.load(this.preset));
    else if (e.key == 'R') console.log('reset', this.reset());
    else if (e.key == 'D') console.log('delayed start', this.waitAndReplay());
    else if (e.key == 'C') console.log('clear', this.clearOverlay());
    else if (e.key == 'S') console.log('show', this.show());
    else if (e.key == '1') console.log('preset 1', this.load(this.preset = 0), this.clearOverlay(), this.show());
    else if (e.key == '2') console.log('preset 2', this.load(this.preset = 1), this.clearOverlay(), this.show());
    else if (e.key == '3') console.log('preset 3', this.load(this.preset = 2), this.clearOverlay(), this.show());
    else if (e.key == '4') console.log('preset 4', this.load(this.preset = 3), this.clearOverlay(), this.show());
    else if (e.key == '5') console.log('preset 5', this.load(this.preset = 4), this.clearOverlay(), this.show());
    else if (e.key == '6') console.log('preset 6', this.load(this.preset = 5), this.clearOverlay(), this.show());
    else if (e.key == '7') console.log('preset 7', this.load(this.preset = 6), this.clearOverlay(), this.show());
  });
};
window.ethanElvenar = window.ethanElvenar || new Elvenar();
