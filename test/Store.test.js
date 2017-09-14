"use strict";
import test from "ava";
import { Store, observable, autorun, computed, startTransaction, endTransaction } from "../dist/observable";

test('Store', t => {
  const store = Store(
    {
      counter: 0,
      first: "Andy",
      last: "Johnson",
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
    }
  );
  let triggeredFullname = 0;
  autorun(() => {
    let x = store.fullname;
    triggeredFullname++;
  })
  store.updateFirst("Jon");
  store.updateLast("Doe");

  t.is(triggeredFullname, 3);
});

test('Bad Action Name', t => {
  t.throws(() => Store({
    test: 0
  }, {
    test: function() {}
  }));
});

test('Run observable outside of transaction', t => {
  const test = observable(0);
  let count = 0;
  autorun(() => {
    let val = test.get();
    count++;
  })
  t.is(count, 1);
  test.set(1);
  t.is(count, 2);
});

test("Can't set a computed", t => {
  const store = Store({
    first: "Andy",
    last: "Johnson",
    fullname: function() {
      return `${this.first} ${this.last}`;
    }
  }, {})

  t.throws(() => {
    store.fullname = "Throws";
  });
  t.is(store.fullname, "Andy Johnson");
});

test("allow non-observable state...", t => {
  const store = Store({
    counter: 0
  }, {}, false);
  let count = 0;
  autorun(() => {
    let val = store.counter;
    count++;
  });
  t.is(count, 1);
  store.counter++;
  t.is(store.counter, 1);
  t.is(count, 2);
});

test("allow new state to be added to store after init", t => {
  const store = Store({
    counter: 0
  }, {}, false);
  store["test"] = "Test";
  t.is(store.test, "Test");
});

test("run computed stand-alone", t => {
  const first = observable("Andy");
  const last = observable("Johnson");
  const val = computed(() => {
    return first.get() + " " + last.get();
  })

  t.is(val.get(), "Andy Johnson");
});

test("overlapping transactions", t => {
  const counter = observable(0);
  const first = observable("Andy");
  const last = observable("Johnson");
  const fullname = computed(() => {
    return `${first.get()} ${last.get()}`;
  });
  const x = computed(() => {
    return `${fullname.get()}: ${counter.get()}`;
  })

  let nameCount = 0;
  autorun(() => {
    let name = fullname.get();
    nameCount++;
  });
  t.is(nameCount, 1);

  let xCount = 0;
  autorun(() => {
    let xVal = x.get();
    xCount++;
  });
  t.is(xCount, 1);

  startTransaction();
  first.set("Jon");
  startTransaction();
  last.set("Doe");
  counter.set(1);  
  endTransaction();
  t.is(nameCount, 1);
  t.is(xCount, 1);
  endTransaction();
  t.is(nameCount, 2);
  t.is(xCount, 2);
});