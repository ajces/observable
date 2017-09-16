// initial code from https://www.youtube.com/watch?v=TfxfRkNCnmk
"use strict";
import { randomString } from "@ajces/utils";

const KEY_LENGTH = 8;
const stack = [];

// create these helpers after... may add properties to describe what each var is...
function isObservable(o) {
  return typeof o === "function" && o._type === "observable";
}

function Observable(newValue) {
  let value = newValue;
  const observers = [];
  const fn = function(newValue) {
    if (newValue != null) { // set
      value = newValue;
      observers.forEach(o => {
        o.run();
      });
    } else {
      if (stack.length > 0) {
        stack[stack.length - 1].addDependency(fn);
      }
      return value;
    }
  }
  fn._type = "observable";
  fn.subscribe = function(observer) {
    observers.push(observer);
  };
  fn.unsubscribe = function(observer) {
    observers.splice(observers.indexOf(observer), 1);
  };
  return fn;
}

function isDispose(o) {
  return typeof o === "function" && o._type === "dispose";
}

function autorun(thunk) {
  const observing = []; 
  const reaction = {
    addDependency: function(observable) {
      observing.push(observable);
    },
    run: function() {
      stack.push(this);
      observing.splice(0).forEach(o => o.unsubscribe(this));
      thunk();
      observing.forEach(o => o.subscribe(this));
      stack.pop(this);
    }
  };
  reaction.run();
  const dispose = function() {
    // clean up observable stuff associate with this autorun...
  }
  dispose._type = "dispose";
  return dispose;
}

function isComputed(o) {
  return typeof o === "function" && o._type === "computed";
}

function Computed(thunk, context) {
  const current = Observable(undefined);
  const computation = function() {
    const result = context != null ? thunk.call(context) : thunk();
    current(result);
  };
  autorun(computation);
  const fn = function() {
    // throw error if args > 0?  that would mean someone tried to set computed...
    return current();
  }
  fn._type = "computed";
  return fn;
}

function Store(state) {
  const observe = []; // array of keys to observe...
  const proxy = new Proxy(state, {
    get: function(target, name, receiver) {
      if (name in target) {
        if (typeof target[name] === "function" && target[name].toString())
        return target[name];
      } else {
        return undefined;
      }
    },
    set: function(target, name, value, receiver) {
      if (name in target) {

        return true;
      } else {
        return false;
      }
    },
    apply: function(target, context, args) {
      // function to modify the observable...
      //store("data", "key", value, bUnobserved=false);
      //store("action", "key", fn);
      //store("computed", "key", fn);
      //store("child", "key", {});
    },
    deleteProperty: function(target, name) {
      // handle removing observer stuff for this key..
    }
  });

  /*
  Object.keys(state).forEach(function(key) {
    if (typeof state[key] === "function") {
      state[key] = computed(state[key], proxy);
    } else if (autoWrapState) {
      state[key] = observable(state[key]);
    }
  });

  Object.keys(actions).forEach(function(key) {
    if (key in state) {
      throw new Error("action and state conflict for key = " + key);
    }
    const fn = actions[key];
    actions[key] = action(fn, proxy);
  });
  */
  return proxy;
}

const count = Observable(0);
const first = Observable("Andy");
const last = Observable("Johnson");
const fullName = Computed(() => {
  return first() + " " + last();
});
const fullCount = Computed(() => {
  return fullName() + ": " + count();
})

autorun(() => {
  console.log(fullName());
});

autorun(() => {
  console.log(fullCount());
})

count(2);
first("Jon");
last("Doe");
last("FOOBAR");