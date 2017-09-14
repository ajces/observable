// initial code from https://www.youtube.com/watch?v=TfxfRkNCnmk
"use strict";
import { randomString } from "@ajces/utils";

const stack = [];

const transaction = {}; // {[randomString(KEY_LENGTH)]: {reaction, count}}
const KEY_LENGTH = 8;

let isTransaction = false;
let actions = 0;

export function startTransaction() {
  actions++;
  if (isTransaction === false) {
    isTransaction = true;
  }
}

export function endTransaction() {
  if (actions > 0) {
    actions--;
  }
  while(isTransaction && actions === 0) {
    const keys = Object.keys(transaction);
    if (keys.length === 0) {
      isTransaction = false;
      break;
    }
    keys.forEach(key => {
      const obj = transaction[key];
      if (obj.count === 0) {
        obj.reaction.run();
        delete transaction[key];
      } else {
        obj.count -= 1;
      }
    })
  }
}

export function action(thunk, context) {
  return function() {
    startTransaction();
    if (context != null) {
      thunk.apply(context, arguments);
    } else {
      thunk(arguments);
    }
    endTransaction();
  }
}

export function Store(initialState, actions) {
  var proxy = new Proxy(initialState, {
    get: function(target, name, receiver) {
      if (name in target && target[name] != undefined) {
        if (target[name].get != null) {
          return target[name].get();
        } else {
          return target[name];
        }
      } else {
        return undefined;
      }
    },
    set: function(target, name, value, receiver) {
      if (name in target) {
        if (target[name].set != null && value.set == null) {
          if (value.set == null) {
            target[name].set(value);
          } else {
            target[name] = value;
          }
        } else { // can't set computed 
          return false;
        }
      } else {
        target[name] = value;
      }
      return true;
    }
  });
  return proxy;
}

export function observableValue(initialValue) {
  let value = initialValue;
  const observers = [];

  return {
    subscribe: function(observer) {
      observers.push(observer);
    },
    unsubscribe: function(observer) {
      observers.splice(observers.indexOf(observer), 1);
    },
    set: function(newValue) {
      value = newValue;
      observers.forEach(o => {
        if (isTransaction) {
          var key = o.key;
          if (key in transaction) {
            transaction[key].count += 1;
          } else {
            transaction[key] = { count: 1, reaction: o };
          }
        } else {
          o.run()
        }
      });
    },
    get: function() {
      if (stack.length > 0) {
        stack[stack.length - 1].addDependency(this);
      }
      return value;
    }
  }
}

export function autorun(thunk) {
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
    },
    key: thunk.key ? thunk.key : randomString(KEY_LENGTH)
  }
  reaction.run();
}

export function computed(thunk, context) {
  const current = observableValue(undefined);
  const computation = function() {
    const result = context != null ? thunk.call(context) : thunk();
    current.set(result);
  }
  computation.key = randomString(KEY_LENGTH);
  autorun(computation);
  return current;
}

const first = observableValue("Andy");
const last = observableValue("Johnson");

const fullname = computed(() => {
  return first.get() + " " + last.get();
});

autorun(() => {
  console.log(fullname.get());
})

first.set("Jon");
last.set("Doe");