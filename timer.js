var CharmTimer;
(function(window){
  'use strict';

  /* デバグフラグ */
  var DEBUG = true;

  /*
   */
  CharmTimer = function(inputFormElement, displayElement, logElement) {
    this._inputForm = new InputForm(inputFormElement);
    this._displayElement = displayElement;
    this._logElement = logElement;
  };
  CharmTimer.prototype = {
    init: function() {
      d('#init');
      var _this = this;
      this._inputForm.getStartButtonElement().addEventListener('click', function(event) {
        event.preventDefault();
        try {
          _this.start(event);
        } catch (e){
          console.log('%o', e);
        }
        return false;
      });
    },

    start: function(event) {
      d('#start');
      if (!this._inputForm.validate()) {
        i('入力フォームが不正');
        return false;
      }

      i('計測スタート');
      var machineDateTime = this._inputForm.getMachineDatetime();
      var charCTime = this._inputForm.getCharactorSelectionTime();
      var alchCTime = this._inputForm.getAlchemicRequestTime();
      d('本体設定時間: %o', machineDateTime);
      d('キャラ選択時間: %o', charCTime);
      d('錬金依頼時間: %o', alchCTime);

      return false;
    },
  };

  /*
   */
  var InputForm = function(inputFormElement) {
    this._element = inputFormElement;
  };
  InputForm.prototype = {
    validate: function() {
      return this._element.checkValidity();
    },
    getMachineDatetime: function() {
      var input = this._element.querySelector('input[name="ct-machine-datetime"]');
      return new Date(input.valueAsNumber);
    },
    getCharactorSelectionTime: function() {
      return this._getCTimeByName('ct-charactor-selection-time');
    },
    getAlchemicRequestTime: function() {
      return this._getCTimeByName('ct-alchemic-request-time');
    },
    getStartButtonElement: function() {
      return this._element.querySelector('button');
    },

    _getCTimeByName: function(name) {
      var field = this._element.querySelector('fieldset[name="' + name + '"]');
      var inputs = field.getElementsByTagName('input');
      var min = parseInt(inputs[0].value);
      var sec = parseInt(inputs[1].value);
      var msec = parseInt(inputs[2].value) * 10;
      return new CTime(min, sec, msec);
    },
  };

  /*
   */
  var CTime = function(minutes, seconds, milliseconds) {
    this._minutes = minutes;
    this._seconds = seconds;
    this._milliseconds = milliseconds;
  };
  CTime.prototype = {
    toMilliseconds: function(){
      return ((((this._minutes) * 60) + this._seconds) * 1000) + this.milliseconds;
    },
  }

  var d = DEBUG ? console.log.bind(console) : function(){};
  var i = console.log.bind(console);
})(window);
