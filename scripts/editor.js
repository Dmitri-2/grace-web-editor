"use strict";

var $, ace, audio, compiler, feedback, intervals, path, timers, windows;

$ = require("jquery");

ace = require("brace");
path = require("path");

require("brace/ext/searchbox");
require("setimmediate");

compiler = require("./compiler");
feedback = require("./feedback");

require("./ace/mode-grace");
require('brace/theme/ambiance');
require('brace/theme/chaos');
require('brace/theme/chrome');
require('brace/theme/clouds_midnight');
require('brace/theme/clouds');
require('brace/theme/cobalt');
require('brace/theme/crimson_editor');
require('brace/theme/dawn');
require('brace/theme/dreamweaver');
require('brace/theme/eclipse');
require('brace/theme/github');
require('brace/theme/idle_fingers');
require('brace/theme/katzenmilch');
require('brace/theme/kr_theme');
require('brace/theme/kuroir');
require('brace/theme/merbivore_soft');
require('brace/theme/merbivore');
require('brace/theme/mono_industrial');
require('brace/theme/monokai');
require('brace/theme/pastel_on_dark');
require('brace/theme/solarized_dark');
require('brace/theme/solarized_light');
require('brace/theme/terminal');
require('brace/theme/textmate');
require('brace/theme/tomorrow_night_blue');
require('brace/theme/tomorrow_night_bright');
require('brace/theme/tomorrow_night_eighties');
require('brace/theme/tomorrow_night');
require('brace/theme/tomorrow');
require('brace/theme/twilight');
require('brace/theme/vibrant_ink');
require('brace/theme/xcode');

windows = [];
timers = [];
intervals = [];
audio = [];

exports.setup = function (files, view, fdbk, hideReveal) {
  var download, drop, search, editor, fileName, opening, rename, session, defaultEditorSettings;

  function stop() {
    windows.forEach(function (win) {
      win.close();
    });

    timers.forEach(function (tim) {
      clearTimeout(tim);
    });

    intervals.forEach(function (ter) {
      clearInterval(ter);
    });

    audio.forEach(function (aud) {
      aud.pause();
    });

    feedback.compilation.stop();
  }

  function checkStop() {
    if (windows.length === 0 &&
        timers.length === 0 && intervals.length === 0 && audio.length === 0) {
      stop();
      return true;
    }

    return false;
  }

  global.checkStop = checkStop;

  global.graceRegisterWindow = function (win) {
    windows.push(win);
    win.addEventListener("unload", function () {
      windows.pop(win);
      checkStop();
    });
  };

  global.graceRegisterTimeout = function (timer) {
    timers.push(timer);
  };

  global.graceRegisterInterval = function (interval) {
    timers.push(interval);
  };

  global.graceRegisterAudio = function (element) {
    audio.push(element);
  };

  download = view.find(".download");
  fileName = view.find(".file-name");
  search = view.find(".search");
  drop = view.find(".delete");

  rename = view.find(".file-name-input");
  
  function runProgram() {
    var escaped, modname;

    feedback.running();

    modname = path.basename(fileName.text(), ".grace");
    escaped = "gracecode_" + modname.replace("/", "$");

    global.gracecode_main = global[escaped];
    global.theModule = global[escaped];

    minigrace.lastSourceCode = editor.getValue();
    minigrace.lastModname = modname;
    minigrace.lastMode = "js";
    minigrace.lastDebugMode = true;

    minigrace.stdout_write = function (value) {
      feedback.output.write(value);
      openOutputViewIfHidden();
    };

    minigrace.stderr_write = function (value) {
      feedback.output.error(value);
      openOutputViewIfHidden();
      stop();
    };

    try {
      minigrace.run();
    } catch (error) {
      feedback.output.error(error.toString());
      openOutputViewIfHidden();
      stop();
    }

    if (!checkStop()) {
      return stop;
    }
  }

  function setDownload(name, text) {
    download.attr("href", URL.createObjectURL(new Blob([ text ], {
      "type": "text/x-grace"
    }))).attr("download", name);
  }

  editor = ace.edit(view.find(".editor")[0]);
  editor.$blockScrolling = Infinity;

  session = editor.getSession();
  session.setTabSize(2);
  session.setMode("ace/mode/grace");

  defaultEditorSettings = {
    theme: 'ace/theme/chrome',
    fontSize: 14,
    foldStyle: 'markbegin',
    wrap: 'off',
    highlightActiveLine: true,
    showInvisibles: false,
    displayIndentGuides: true,
    showGutter: true,
    softTabs: true
  }

  loadEditorSettings();

  session.on("change", function () {
    var name, value;

    if (opening) {
      return;
    }

    name = fileName.text();
    value = session.getValue();

    if (files.isChanged(name, value)) {
      compiler.forget(name);
      stop();
      feedback.compilation.waiting();
    }

    setDownload(name, value);
    files.save(value);

    session.clearAnnotations();
  });

  editor.focus();

  feedback = feedback.setup(fdbk, function () {
    var modname, name;

    name = fileName.text();
    modname = path.basename(name, ".grace");

    compiler.compile(modname, session.getValue(), function (reason) {
      if (reason !== null) {
        feedback.error(reason);
        openOutputViewIfHidden();

        if (reason.module === name && reason.line) {
          session.setAnnotations([ {
            "row": reason.line - 1,
            "column": reason.column && reason.column - 1,
            "type": "error",
            "text": reason.message
          } ]);
        }
      } else {
        feedback.compilation.ready();
        runProgram();
      }
    });
  }, function () {
      runProgram();
  });

  function openOutputViewIfHidden() {
    if (view.find("#output-view").hasClass("hide")) {
      toggleOutputView();
    }
  }

  function toggleOutputView() {
    var fileView = view.find(".open-file");
    var outputView = view.find("#output-view");
    var hideRevealIcon = view.find("#output-hide-reveal-icon");

    if (outputView.hasClass("hide")) {
      fileView.animate({
        height: (view.height() - fdbk.height()) + "px",
      }, 400);

      outputView.animate({
        flexGrow: "1",
        padding: "8px",
        borderBottomWidth: "1pt",
      }, 400, function() {
        outputView.removeClass("hide");
        hideRevealIcon.html("<b>&#x276C;</b>");
      });
    } else {
      fileView.animate({
        height: (view.height() - view.find(".compilation").height()) + "px",
      }, 400);

      outputView.animate({
        flexGrow: "0",
        padding: "0px",
        borderBottomWidth: "0px",
      }, 400, function() {
        outputView.addClass("hide");
        hideRevealIcon.html("<b>&#x276D;</b>");
      });
    }
  }

  hideReveal.mouseup(function () {
    toggleOutputView();
  });

  files.onOpen(function (name, content) {
    var slashIndex = name.lastIndexOf("/");

    if (slashIndex !== -1) {
      name = name.substring(slashIndex + 1);
    }

    fileName.text(name);
    setDownload(name, content);

    opening = true;
    session.setValue(content);
    opening = false;

    if (compiler.isCompiled(name)) {
      feedback.compilation.ready();
    } else if (compiler.isCompiling(name)) {
      feedback.compilation.building();
    } else {
      feedback.compilation.waiting();
    }

    view.removeClass("hidden");
    editor.focus();
  });

  drop.click(function () {
    if (confirm("Are you sure you want to delete this file?")) {
      files.remove();
      view.addClass("hidden");
      feedback.output.clear();
    }
  });

  function resize() {
    rename.attr("size", rename.val().length + 1);
  }

  fileName.click(function () {
    fileName.hide();
    rename.val(fileName.text()).css("display", "inline-block").focus();
    resize();
  });

  rename.change(function () {
    var name = rename.css("display", "none").val();
    fileName.show();
    files.rename(name);
  }).keypress(function (event) {
    if (event.which === 13) {
      rename.blur();
    } else {
      resize();
    }
  }).keydown(resize).keyup(resize);

  // Ace seems to have trouble with adjusting to flexible CSS. Force a resize
  // once the size settles.
  setImmediate(function () {
    editor.resize(true);
  });

  $(".sidebar-buttons").on('mouseup', '*', function () {
    showSidebarView($(this).attr('value'));
  });

  function showSidebarView(view) {
    var refactorView = $("#refactor-view");
    var settingsView = $("#settings-view");
    var filesView = $("#files-view");

    var refactorButton = $("#show-refactor");
    var settingsButton = $("#show-settings");
    var filesButton = $("#show-files");

    if (view == "refactor") {
      refactorView.removeClass("hidden");
      settingsView.addClass("hidden");
      filesView.addClass("hidden");

      refactorButton.addClass("hidden");
      settingsButton.removeClass("hidden");
      filesButton.removeClass("hidden");
    } else if (view == "settings") {
      refactorView.addClass("hidden");
      settingsView.removeClass("hidden");
      filesView.addClass("hidden");

      refactorButton.removeClass("hidden");
      settingsButton.addClass("hidden");
      filesButton.removeClass("hidden");
    } else if (view == "files") {
      refactorView.addClass("hidden");
      settingsView.addClass("hidden");
      filesView.removeClass("hidden");

      refactorButton.removeClass("hidden");
      settingsButton.removeClass("hidden");
      filesButton.addClass("hidden");
    }
  }

  search.mouseup(function () {
    if (search.find(".label").html() == "Search") {
      editor.execCommand("find");
      search.find(".label").html("Replace");
    } else {
      editor.execCommand("replace");
      search.find(".label").html("Search");
    }
  });

  function loadEditorSettings() {
    var theme, fontSize, foldStyle, wrap, highlightActiveLine, showInvisibles, displayIndentGuides, showGutter, softTabs;

    if (typeof localStorage.editorTheme === 'undefined') {
      localStorage.editorTheme = defaultEditorSettings.theme;
    }

    if (typeof localStorage.editorFontSize === 'undefined') {
      localStorage.editorFontSize = defaultEditorSettings.fontSize;
    }

    if (typeof localStorage.editorFoldStyle === 'undefined') {
      localStorage.editorFoldStyle = defaultEditorSettings.foldStyle;
    }

    if (typeof localStorage.editorWrap === 'undefined') {
      localStorage.editorWrap = defaultEditorSettings.wrap;
    }

    if (typeof localStorage.editorHighlightActiveLine === 'undefined') {
      localStorage.editorHighlightActiveLine = defaultEditorSettings.highlightActiveLine;
    }

    if (typeof localStorage.editorShowInvisibles === 'undefined') {
      localStorage.editorShowInvisibles = defaultEditorSettings.showInvisibles;
    }

    if (typeof localStorage.editorDisplayIndentGuides === 'undefined') {
      localStorage.editorDisplayIndentGuides = defaultEditorSettings.displayIndentGuides;
    }

    if (typeof localStorage.editorShowGutter === 'undefined') {
      localStorage.editorShowGutter = defaultEditorSettings.showGutter;
    }

    if (typeof localStorage.editorSoftTabs === 'undefined') {
      localStorage.editorSoftTabs = defaultEditorSettings.softTabs;
    }

    theme = localStorage.editorTheme;
    fontSize = localStorage.editorFontSize;
    foldStyle = localStorage.editorFoldStyle;
    wrap = localStorage.editorWrap;
    highlightActiveLine = localStorage.editorHighlightActiveLine === 'true';
    showInvisibles = localStorage.editorShowInvisibles === 'true';
    displayIndentGuides = localStorage.editorDisplayIndentGuides === 'true';
    showGutter = localStorage.editorShowGutter === 'true';
    softTabs = localStorage.editorSoftTabs === 'true';

    editor.setTheme(theme);
    editor.setFontSize(fontSize);
    document.getElementById('output-view').style.fontSize = fontSize;
    session.setFoldStyle(foldStyle);
    editor.setOption("wrap", wrap);
    editor.setHighlightActiveLine(highlightActiveLine);
    editor.setShowInvisibles(showInvisibles);
    editor.setDisplayIndentGuides(displayIndentGuides);
    editor.renderer.setShowGutter(showGutter);
    session.setUseSoftTabs(softTabs);

    $('#settings-view #theme option:eq(' + theme + ')').prop('selected', true);
    $('#settings-view #fontsize option:eq(' + fontSize + ')').prop('selected', true);
    $('#settings-view #folding option:eq(' + foldStyle + ')').prop('selected', true);
    $('#settings-view #soft-wrap option:eq(' + wrap + ')').prop('selected', true);
    $('#settings-view #highlight-active').prop('checked', highlightActiveLine);
    $('#settings-view #show-hidden').prop('checked', showInvisibles);
    $('#settings-view #display-indent-guides').prop('checked', displayIndentGuides);
    $('#settings-view #show-gutter').prop('checked', showGutter);
    $('#settings-view #soft-tab').prop('checked', softTabs);
  }

  $("#settings-view #theme").on('change', function() {
    editor.setTheme(this.value);
    localStorage.editorTheme = this.value;
  });

  $("#settings-view #fontsize").on('change', function() {
    editor.setFontSize(this.value);
    document.getElementById('output-view').style.fontSize = this.value;
    localStorage.editorFontSize = this.value;
  });

  $("#settings-view #folding").on('change', function() {
    session.setFoldStyle(this.value);
    localStorage.editorFoldStyle = this.value;
  });

  $("#settings-view #soft-wrap").on('change', function() {
    editor.setOption("wrap", this.value);
    localStorage.editorWrap= this.value;
  });

  $("#settings-view #highlight-active").on('change', function() {
    editor.setHighlightActiveLine(this.checked);
    localStorage.editorHighlightActiveLine = this.checked;
  });

  $("#settings-view #show-hidden").on('change', function() {
    editor.setShowInvisibles(this.checked);
    localStorage.editorShowInvisibles = this.checked;
  });

  $("#settings-view #display-indent-guides").on('change', function() {
    editor.setDisplayIndentGuides(this.checked);
    localStorage.editorDisplayIndentGuides = this.checked;
  });

  $("#settings-view #show-gutter").on('change', function() {
    editor.renderer.setShowGutter(this.checked);
    localStorage.editorShowGutter = this.checked;
  });

  $("#settings-view #soft-tab").on('change', function() {
    session.setUseSoftTabs(this.checked);
    localStorage.editorSoftTabs = this.checked;
  });

  function stringRepeat(pattern, count) {
    if (count < 1) return '';
    var result = '';
    while (count > 1) {
        if (count & 1) result += pattern;
        count >>= 1, pattern += pattern;
    }
    return result + pattern;
  }

  function formatGrace(code) {
    var indentLevel = 0;
    var formattedCode = '';
    var lines = code.split("\n");

    for (var i = 0; i < lines.length; i++) { 
      var line = lines[i].trim();

      if (line != "\n") {
        var padding = '';

        if (line.indexOf("}") > -1) {
          indentLevel--;
        }

        for (var j = 0; j < indentLevel; j++) {
          padding += stringRepeat(' ', session.getTabSize());
        }

        line = padding + line;

        if (line.indexOf("{") > -1) {
          indentLevel++;
        }
      }

      if (i + 1 != lines.length) {
        line += '\n';
      }

      formattedCode += line;
    }

    return formattedCode;
  }

  $("#refactor-view #refactor-reindent").mouseup(function () {
    var code = editor.getSession().getValue();
    editor.getSession().setValue(formatGrace(code));
  });

  return editor;
};
