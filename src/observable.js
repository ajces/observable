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
  console.log(transaction);
  if (actions > 0) {
    actions--;
  }
  while (isTransaction && actions === 0) {
    const keys = Object.keys(transaction);
    if (keys.length === 0) {
      isTransaction = false;
      break;
    }
    keys.forEach(function(key) {
      const obj = transaction[key];
      if (obj.count === 1) {
        obj.reaction.run();
        delete transaction[key];
      } else if (obj.count > 1) {
        obj.count -= 1;
      }
    });
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
  };
}

export function Store(state, actions, autoWrapState = true) {
  const proxy = new Proxy(state, {
    get: function(target, name, receiver) {
      if (name in target && target[name] != undefined) {
        if (target[name].get != null) {
          return target[name].get();
        } else {
          return target[name];
        }
      } else {
        if (name in actions) {
          return actions[name];
        } else {
          return undefined;
        }
      }
    },
    set: function(target, name, value, receiver) {
      if (name in target) {
        if (target[name].set != null) {
          if (target[name]._noset === true) {
            return false;
          } else if (value.set == null) {
            target[name].set(value);
          } else {
            target[name] = value;
          }
        } else {
          target[name] = value;
        }
      } else {
        target[name] = value;
      }
      return true;
    }
  });

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

  return proxy;
}

export function observable(initialValue) {
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
          o.run();
        }
      });
    },
    get: function() {
      if (stack.length > 0) {
        stack[stack.length - 1].addDependency(this);
      }
      return value;
    }
  };
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
  };
  reaction.run();
}

export function computed(thunk, context) {
  const current = observable(undefined);
  const computation = function() {
    const result = context != null ? thunk.call(context) : thunk();
    current.set(result);
  };
  computation.key = randomString(KEY_LENGTH);
  autorun(computation);
  current._noset = true;
  return current;
}

const counter = observable(0);
const first = observable("Andy");
const last = observable("Johnson");
const fullname = computed(() => {
  return `${first.get()} ${last.get()}`;
});
const x = computed(() => {
  return `${fullname.get()}: ${counter.get()}`;
})

autorun(() => {
  console.log(fullname.get());
});

autorun(() => {
  console.log(x.get());
});

startTransaction();
first.set("Jon");
last.set("Doe");
counter.set(1);  
endTransaction();
