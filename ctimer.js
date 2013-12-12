var CharmTimer;
(function(window){
  'use strict';

  var document = window.document,
  location = window.location;

  /* デバグフラグ */
  var DEBUG = (location.protocol === 'file:') ||
    (location.host.match(/^localhost:?/)) ||
    (location.hash.match(/debug/));

  /* タイマーを更新する間隔 [msec] */
  var TIMER_INTERVAL = 4;

  /* タイムゾーンのオフセット [msec] */
  var TIMEZONE_OFFSET = (new Date()).getTimezoneOffset() * 60 * 1000;

  /* ログの上限 */
  var LOG_LIMIT = 1000;

  /* アラート音ファイルパス */
  var ALERT_FILE = 'beep.mp3';

  /******************************************
   * ViewModel の親玉
   ******************************************/
  CharmTimer = function(inputFormId, alertSettingsFormId, timeDisplayId, logDisplayId){
    // model
    this._alert = new Alert();
    this._timer = null;

    // modelview
    this._inputForm = new CharmTimer.InputForm($('#'+inputFormId)[0]);
    this._alertSettingsForm =
      new CharmTimer.AlertSettingsForm($('#'+alertSettingsFormId)[0], this._alert);
    this._timeDisplay = new CharmTimer.TimeDisplay($('#'+timeDisplayId)[0]);
    this._logDisplay = new CharmTimer.LogDisplay($('#'+logDisplayId)[0]);
  };
  CharmTimer.prototype = {
    init: function() {
      d('#init');

      this._inputForm.load();
      this._logDisplay.load();

      this._reset();

      this._inputForm.onStartButtonClick((function(event){
        event.preventDefault();

        this._reset();
        this._inputForm.save();

        if (this._inputForm.validate()) {
          this._startTimer();
        } else {
          e('invalid value');
        }
        return false;
      }).bind(this));
    },
    _reset: function() {
      if (this._timer)
        this._timer.destroy();
      this._inputForm.resetErrorMessages();
    },
    _startTimer: function() {
      d('#_startTimer');
      this._timer = new Timer(
        this._inputForm.getCharactorSelectionCTime(),
        this._inputForm.getAlchemyRequestCTime(),
        this._alert);
      this._timer.onUpdate((function(status){
        this._timeDisplay.render(status);
      }).bind(this));
      this._timer.start();

      this._logDisplay.log(this._inputForm);
    },
  };

  /******************************************
   * ViewModel のようなもの
   ******************************************/

  /* 入力フォーム群の取りまとめ */
  CharmTimer.InputForm = function(form) {
    this._form = form;
    this._startButton = $$(this._form, 'button[name="ct-start"]')[0];
    this._machineDatetime = $$(this._form, '[name="ct-machine-datetime"]')[0];
    this._charSelTimeForm = new CharmTimer.CTimeForm(
      $$(this._form, '[name="ct-charactor-selection-time"]')[0]);
    this._alchReqTimeForm = new CharmTimer.CTimeForm(
      $$(this._form, '[name="ct-alchemy-request-time"]')[0]);
    this._errMsgElement = $$(this._form, '#ct-error-message')[0];
    this._storage = new Storage('ct-input-form');

    this._machineDatetime.value = this._buildDatetimeLocalString(new Date());

    var cb = (function(event) {
      this.save();
    }).bind(this);
    this._machineDatetime.addEventListener('change', cb);
    this._alchReqTimeForm.onChange(cb);
    this._charSelTimeForm.onChange(cb);
  };
  CharmTimer.InputForm.prototype = {
    load: function() {
      var o = this._storage.get('_');
      if(!o) return;
      d('load inputForm: %o', o);

      var date = new Date(o.machineDatetime);
      var dateString = this._buildDatetimeLocalString(date);
      this._machineDatetime.value = dateString;

      this._charSelTimeForm.setCTime(CTime.fromMilliseconds(o.charactorSelectionTime));
      this._alchReqTimeForm.setCTime(CTime.fromMilliseconds(o.alchemyRequestTime));
    },
    _buildDatetimeLocalString: function(date) {
      return padLeft(date.getFullYear(), '0', 4) + '-' +
        padLeft(date.getMonth() + 1, '0', 2) + '-' +
        padLeft(date.getDate(), '0', 2) + 'T' +
        padLeft(date.getHours(), '0', 2) + ':' +
        padLeft(date.getMinutes(), '0', 2) + ':' +
        padLeft(date.getSeconds(), '0', 2);
    },
    save: function() {
      this._storage.delaySet('_', {
        machineDatetime: this.getMachineDatetime().getTime(),
        charactorSelectionTime: this.getCharactorSelectionCTime().toMilliseconds(),
        alchemyRequestTime: this.getAlchemyRequestCTime().toMilliseconds(),
      });
    },
    validate: function() {
      var violations = this._validate();
      var result = violations.length === 0;
      if (!result)
        this._renderErrorMessages(violations);
      return result;
    },
    _validate: function() {
      var violations = [];
      if (!this._form.checkValidity())
        violations.push('入力値が不正です');
      if (!this._validateCTimes())
        violations.push('キャラ選択時間 &gt; 錬金依頼時間 になるように指定してください');
      return violations;
    },
    _validateCTimes: function() {
      return this.getCharactorSelectionCTime() < this.getAlchemyRequestCTime();
    },
    _renderErrorMessages: function(violations) {
      var html = '<ul>';
      for(var i = 0, len = violations.length; i < len; i++) {
        html += '<li>';
        html += violations[i];
      }
      html += '</ul>';
      this._errMsgElement.innerHTML = html;
    },

    resetErrorMessages: function(){
      this._errMsgElement.innerHTML = '';
    },

    onStartButtonClick: function(cb) {
      this._startButton.addEventListener('click', cb);
    },
    getMachineDatetime: function() {
      var msec = (~~(this._machineDatetime.valueAsNumber / 1000)) * 1000;
      return new Date(msec + TIMEZONE_OFFSET);
    },
    getCharactorSelectionCTime: function(){
      return this._charSelTimeForm.getCTime();
    },
    getAlchemyRequestCTime: function() {
      return this._alchReqTimeForm.getCTime();
    },
  };

  /* 時間入力フォーム（キャラ選択時間、錬金依頼時間） */
  CharmTimer.CTimeForm = function(fieldset) {
    this._fieldset = fieldset;
  };
  CharmTimer.CTimeForm.prototype = {
    getCTime: function(){
      var inputs = $$(this._fieldset, 'input');
      var min = parseInt(inputs[0].value, 10);
      var sec = parseInt(inputs[1].value, 10);
      var msec = parseInt(inputs[2].value, 10) * 10;
      return new CTime(min, sec, msec);
    },
    setCTime: function(ctime) {
      var inputs = $$(this._fieldset, 'input');
      inputs[0].value = ctime.getMinutes().toString();
      inputs[1].value = ctime.getSeconds().toString();
      inputs[2].value = (ctime.getMilliseconds() / 10).toString();
    },
    onChange: function(cb) {
      this._fieldset.addEventListener('change', cb);
      this._fieldset.addEventListener('keyup', cb);
      this._fieldset.addEventListener('click', cb);
    }
  };

  /* アラート音設定 */
  CharmTimer.AlertSettingsForm = function(alertSettingsFormElement, alert) {
    var inputs = $$(alertSettingsFormElement, 'input');
    this._secondsInputElement = inputs[0];
    this._volumeInputElement = inputs[1];
    this.alert = alert;
    this.setVolume(1);
    this.setSeconds(10);

    this._storage = new Storage('alert-settings');
    this.load();

    var secondsChangeCallback = function(e) {
      this.alert.prealertSeconds = this._secondsInputElement.valueAsNumber;
      this.save();
    };
    this._secondsInputElement.addEventListener('change', secondsChangeCallback.bind(this));
    this._secondsInputElement.addEventListener('keyup', secondsChangeCallback.bind(this));
    this._secondsInputElement.addEventListener('click', secondsChangeCallback.bind(this));

    var volumeChangeCallback = function(e) {
      this.alert.volume = this._volumeInputElement.valueAsNumber;
      this.alert.play();
      this.save();
    };
    this._volumeInputElement.addEventListener('click', volumeChangeCallback.bind(this));
    this._secondsInputElement.addEventListener('keyup', secondsChangeCallback.bind(this));
  };
  CharmTimer.AlertSettingsForm.prototype = {
    load: function() {
      var o = this._storage.get('_');
      if(!o) return;

      if(o.volume)
        this.setVolume(o.volume);
      if(o.seconds)
        this.setSeconds(o.seconds);
    },
    save: function() {
      this._storage.delaySet('_', {
        seconds: this.alert.prealertSeconds,
        volume: this.alert.volume,
      });
    },
    setVolume: function(v) {
      this._volumeInputElement.value = v;
      this.alert.volume = v;
    },
    setSeconds: function(s) {
      this._secondsInputElement.value = s;
      this.alert.prealertSeconds = s;
    },
  };

  /* 時間表示 */
  CharmTimer.TimeDisplay = function(element) {
    this._element = element;
    this._elapsedTimeElement = $$(element, '#ct-elapsed-time')[0];
    this._charSelRemainingElement = $$(element, '#ct-charactor-selection-remaining')[0];
    this._alchReqRemainingElement = $$(element, '#ct-alchemy-request-remaining')[0];
  };
  CharmTimer.TimeDisplay.prototype = {
    /* 呼ばれる頻度高いので、最低限のリファクタリングに留めている*/
    render: function(timerStatus) {
      this._renderElapsedTime(timerStatus);
      this._renderCharactorSelectionRemaining(timerStatus);
      this._renderAlchemyRequestRemaining(timerStatus);
    },
    _renderElapsedTime: function(timerStatus) {
      this._elapsedTimeElement.textContent =
        formatForMillisec(timerStatus.getElapsedTime());
    },
    _renderCharactorSelectionRemaining: function(timerStatus) {
      var rem = timerStatus.getCharactorSelectionRemaining();
      this._renderRemaining(this._charSelRemainingElement, rem);
    },
    _renderAlchemyRequestRemaining: function(timerStatus){
      var rem = timerStatus.getAlchemyRequestRemaining();
      this._renderRemaining(this._alchReqRemainingElement, rem);
    },
    _renderRemaining: function(element, remaining) {
      if (remaining < -100)
        return;
      element.textContent = formatForMillisec(remaining);
    },
  };
  /* 呼ばれる頻度高いので、最低限のリファクタリングに留めている */
  var formatForMillisec = function(msec){
    if (msec < 0)
      return '00:00.00';

    var c = Math.floor(msec / 10);
    var s = Math.floor(c / 100);
    var minutes  = Math.floor(s / 60);
    var seconds  = s % 60;
    var cSeconds = c % 100;

    var minutesString = minutes.toString();
    if (minutesString.length === 1)
      minutesString = '0' + minutesString;

    var secondsString = seconds.toString();
    if (secondsString.length === 1)
      secondsString = '0' + secondsString;

    var cSecondsString = cSeconds.toString();
    if (cSecondsString.length === 1)
      cSecondsString = '0' + cSecondsString;

    return minutesString + ':' + secondsString + '.' + cSecondsString;
  };


  /* ログ表示 */
  CharmTimer.LogDisplay = function(element) {
    this._element = element;
    this._log = [];
    this._storage = new Storage('ct-log');
    this._logsElement = null;
  };
  CharmTimer.LogDisplay.prototype = {
    load: function() {
      var log = this._storage.get('_');
      if(!log) return;

      this._log = [];
      log.forEach((function(l){
        this._log.push(this._buildLog(l));
      }).bind(this));
      this._render();
      d('loadLog: %o', log);
    },
    save: function() {
      this._storage.delaySet('_', this._log);
    },
    clear: function() {
      this._log = [];
      this.save();
      this._render();
    },
    log: function(inputForm) {
      var l = this._buildLogWithInputForm(inputForm);

      this._log.unshift(l);
      while(this._log.length > LOG_LIMIT)
        this._log.pop();

      this.save();
      this._render();
    },
    _buildLogWithInputForm: function(inputForm){
      return this._buildLog({
        machineDatetime: inputForm.getMachineDatetime().getTime(),
        charactorSelectionTime: inputForm.getCharactorSelectionCTime().toMilliseconds(),
        alchemyRequestTime: inputForm.getAlchemyRequestCTime().toMilliseconds(),
        memo: '',
      });
    },
    _buildLog: function(o) {
      var l = new CharmTimer.Log(o);
      l.onChange((function(){
        this.save();
      }).bind(this));
      l.onDelete((function(){
        this._log = this._log.filter(function(e){
          return l !== e;
        });
        this._render();
        this.save();
      }).bind(this));
      return l;
    },
    _render: function() {
      var table = document.createElement('table');
      table.innerHTML = '<tr>' +
        '<th>本体設定時刻</th>' +
        '<th>キャラ選択</th>' +
        '<th>錬金依頼</th>' +
        '<th>メモ</th>' +
        '<th>削除</th>' +
        '</tr>';
      for(var i = 0, len = this._log.length; i < len; i++) {
        var l = this._log[i];
        table.appendChild(l.toTd());
      }

      if (this._logsElement) {
        this._element.replaceChild(table, this._logsElement);
      } else {
        this._element.appendChild(table);
      }
      this._logsElement = table;
    },
  };

  CharmTimer.Log = function(o) {
    this.machineDatetime = o.machineDatetime;
    this.charactorSelectionTime = o.charactorSelectionTime;
    this.alchemyRequestTime = o.alchemyRequestTime;
    this.memo = o.memo;
    this._changeCallback = null;
  };
  CharmTimer.Log.prototype = {
    toTd: function() {
      var tr = document.createElement('tr');
      CharmTimer.Log._appendTd(tr, this._buildMachineDatetimeString(this.machineDatetime));
      CharmTimer.Log._appendTd(tr, CTime.fromMilliseconds(this.charactorSelectionTime).toString());
      CharmTimer.Log._appendTd(tr, CTime.fromMilliseconds(this.alchemyRequestTime).toString());
      tr.appendChild(this._buildMemoTd());
      tr.appendChild(this._buildDeleteButtonTd());
      return tr;
    },
    _buildMachineDatetimeString: function(msec) {
      var date = new Date(this.machineDatetime);
      return padLeft(date.getFullYear(), '0', 4) + '/' +
        padLeft(date.getMonth() + 1, '0', 2) + '/' +
        padLeft(date.getDate(), '0', 2) + ' ' +
        padLeft(date.getHours(), '0', 2) + ':' +
        padLeft(date.getMinutes(), '0', 2) + ':' +
        padLeft(date.getSeconds(), '0', 2);
    },
    _buildMemoTd: function() {
      var td = document.createElement('td');
      td.appendChild(this._buildMemoEditor());
      return td;
    },
    _buildMemoEditor: function() {
      var span = document.createElement('input');
      span.type = 'text';
      span.value = this.memo;

      var that = this;
      var cb = function(event){
        if (that.memo === this.value)
          return;
        that.memo = this.value;
        that._changeCallback();
      };
      span.addEventListener('change', cb);
      span.addEventListener('keyup', cb);
      span.addEventListener('click', cb);
      return span;
    },
    _buildDeleteButtonTd: function() {
      var td = document.createElement('td');
      td.appendChild(this._buildDeleteButton());
      return td;
    },
    _buildDeleteButton: function() {
      var b = document.createElement('button');
      b.textContent = '✕';
      b.addEventListener('click', this._deleteCallback);
      return b;
    },
    onChange: function(cb) {
      this._changeCallback = cb;
    },
    onDelete: function(cb) {
      this._deleteCallback = cb;
    }
  };
  CharmTimer.Log._appendTd = function(tr, tdTextContent){
    var td = document.createElement('td');
    td.className = 'numbers';
    td.textContent = tdTextContent;
    tr.appendChild(td);
  };

  /******************************************
   * Model のようなもの
   ******************************************/

  /* タイマー */
  var Timer = function(charSelCTime, alchReqCTime, alert) {
    this._charSelCTime = charSelCTime;
    this._alchReqCTime = alchReqCTime;
    this._alert = alert;
    this._startDate = null;
    this._interval = null;
    this._updateCallback = null;
    this._prevCharSelRemainingSec = null;
    this._prevAlchReqRemainingSec = null;
  };
  Timer.prototype = {
    start: function() {
      if (this._startDate)
        throw 'already started';

      this._startDate = new Date();
      var status = this.getStatus();
      this._prevCharSelRemainingSec =
        Math.floor(status.getCharactorSelectionRemaining() / 1000);
      this._prevAlchReqRemainingSec =
        Math.floor(status.getAlchemyRequestRemaining() / 1000);

      this._interval = setInterval((function() {
        var status = this.getStatus();
        this._updateCallback(status);

        var prevSec = this._prevCharSelRemainingSec;
        var currSec = Math.floor(status.getCharactorSelectionRemaining() / 1000);
        this._prevCharSelRemainingSec = currSec;
        if (currSec !== prevSec)
          this._alert.alertIfConditionsAreMet(currSec);

        prevSec = this._prevAlchReqRemainingSec;
        currSec = Math.floor(status.getAlchemyRequestRemaining() / 1000);
        this._prevAlchReqRemainingSec = currSec;
        if (currSec !== prevSec)
          this._alert.alertIfConditionsAreMet(currSec);

      }).bind(this), TIMER_INTERVAL);
    },
    stop: function() {}, // いらないかも
    destroy: function() {
      this._startDate = null;

      clearInterval(this._interval);
      this._interval = null;
    },

    getStatus: function() {
      if (!this._startDate)
        return null;
      return new TimerStatus(this._startDate, new Date(), this._charSelCTime, this._alchReqCTime);
    },

    onUpdate: function(cb) {
      this._updateCallback = cb;
    },
  };

  /* タイマーの状態 */
  var TimerStatus = function(startDate, date, charSelCTime, alchReqCTime) {
    this._startDate = startDate;
    this._startMsec = startDate.getTime();
    this._date = date;
    this._msec = date.getTime();
    this._charactorSelectionMsec = this._startMsec + charSelCTime.toMilliseconds();
    this._alchemyRequestMsec = this._startMsec + alchReqCTime.toMilliseconds();
  };
  TimerStatus.prototype = {
    getStartDate: function() { return this._startDate; },
    getDate: function() { return this._date; },

    getElapsedTime: function() {
      return this._msec - this._startMsec;
    },
    getCharactorSelectionRemaining: function() {
      return this._charactorSelectionMsec - this._msec;
    },
    getAlchemyRequestRemaining: function() {
      return this._alchemyRequestMsec - this._msec;
    },
    isBeforeCharactorSelection: function() {
      return this._msec < this._charactorSelectionMsec;
    },
    isBeforeAlchemyRequest: function() {
      return this._msec < this._alchemyRequestMsec;
    },
  };

  /* 永続化ストレージ */
  var Storage = function(name){
    this._prefix = name;
    this._timeouts = {};
  };
  Storage.prototype = {
    set: function(key, value) {
      var k = this._prefix + key;
      localStorage.setItem(k, JSON.stringify(value));
      d('save: %o %o', k, value);
    },
    get: function(key) {
      return JSON.parse(localStorage.getItem(this._prefix + key));
    },
    delaySet: function(key, value, delay) {
      delay = delay || 300;

      if (this._timeouts[key])
        clearTimeout(this._timeouts[key]);

      this._timeouts[key] = setTimeout((function() {
        this.set(key, value);
      }).bind(this), delay);
    }
  };

  /* 設定時間 */
  var CTime = function(minutes, seconds, milliseconds) {
    this._minutes = minutes;
    this._seconds = seconds;
    this._milliseconds = milliseconds;
  };
  CTime.fromMilliseconds = function(msec) {
    var s = Math.floor(msec / 1000);
    var minutes  = Math.floor(s / 60);
    var seconds  = s % 60;
    var mseconds = msec % 1000;
    return new CTime(minutes, seconds, mseconds);
  };
  CTime.prototype = {
    getMinutes: function() { return this._minutes; },
    getSeconds: function() { return this._seconds; },
    getMilliseconds: function() { return this._milliseconds; },
    toMilliseconds: function() {
      return ((((this._minutes) * 60) + this._seconds) * 1000) + this._milliseconds;
    },
    toString: function() {
      return padLeft(this._minutes, '0', 2) + ':' +
        padLeft(this._seconds, '0', 2) + '.' +
        padLeft(this._milliseconds / 10, '0', 2);
    },
  };

  /* アラート再生 */
  var Alert = function(){
    this.prealertSeconds = 10;
    this.volume = 1;

    this._element = new Audio(ALERT_FILE);
    this._element.loop = false;
    this._element.addEventListener('ended', function(){
      d('ended');

      // google chrome の Audio のバグ？のワークアラウンド
      // 一度再生する二度以降再生されない
      this.currentTime = 0;
      if (this.currentTime !== 0) {
        this.load();
      }
    });
  };
  Alert.prototype = {
    play: function() {
      this._element.volume = this.volume;
      if (this._element.readyState !== HTMLMediaElement.HAVE_ENOUGH_DATA) {
        e('unexpected readyState: %o', this._element);
        return;
      }

      this._element.play();
      d('play');
    },
    alertIfConditionsAreMet: function(sec) {
      if (this.isMeetingConditions(sec)) {
        this.play();
        return true;
      }
      return false;
    },
    isMeetingConditions: function(sec) {
      // 0.01 → 0.00 時も条件に入れるために -1 以上にする必要がある
      return (-1 <= sec) && (sec <= this.prealertSeconds);
    }
  };

  /* 便利関数 */
  var $ = function(query) {
    return document.querySelectorAll(query);
  };
  var $$ = function(base, query) {
    return base.querySelectorAll(query);
  };
  var $$name = function(base, name) {
    return $$(base, '[name="'+name+'"]');
  };
  var d = DEBUG ? console.log.bind(console) : function(){};
  var i = console.log.bind(console);
  var e = console.error.bind(console);
  var padLeft = function(num, ch, width) {
    var numString = num.toString();
    while(width > numString.length)
      numString = ch + numString;
    return numString;
  };
})(window);
