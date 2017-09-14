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

export function Store(state, actions) {
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

  Object.keys(state).forEach(key => {
    if (typeof state[key] === "function") {
      const fn = state[key];
      state[key] = computed(fn, proxy);
    }
  });

  Object.keys(actions).forEach(key => {
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
  const current = observable(undefined);
  const computation = function() {
    const result = context != null ? thunk.call(context) : thunk();
    current.set(result);
  }
  computation.key = randomString(KEY_LENGTH);
  autorun(computation);
  return current;
}

// example store usage
/*
const store = Store({
  counter: observable(0),
  first: observable("Andy"),
  last: observable("Johnson"),
  fullname: function() {
    return `${this.first} ${this.last}`;
  },
  test: function() {
    return `${this.fullname}: ${this.counter}`;
  }
}, {
  updateFirst: function(name) {
    this.first = name;
  },
  updateLast: function(name) {
    this.last = name;
  },
  incrementCounter: function() {
    this.counter++;
  },
  decrementCounter: function() {
    this.counter--;
  }
})

autorun(() => {
  console.log(store.fullname);
});

autorun(() => {
  console.log(store.test);
})

store.updateFirst("Jon");
store.updateLast("Doe");
store.incrementCounter();
*/

/* example usage of raw functions...
const counter = observable(0);
const first = observable("Andy");
const last = observable("Johnson");
const fullname = computed(() => {
  return first.get() + " " + last.get();
});
const test = computed(() => {
  return fullname.get() + " " + counter.get();
});

autorun(() => {
  console.log(fullname.get());
});

autorun(() => {
  console.log(test.get());
});

startTransaction();
first.set("Jon");
last.set("Doe");
endTransaction();
*/