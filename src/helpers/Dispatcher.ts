/**
 * Simple (Event)Dispatcher class
 * Inspiered by https://medium.com/@LeoAref/simple-event-dispatcher-implementation-using-javascript-36d0eadf5a11
 */
export class Dispatcher {

  events: any;

  constructor() {
    this.events = {};
  }

  addListener(event: string, callback: (data?: any) => any) {
    // Create the event if not exists
    if (this.events[event] === undefined) {
      this.events[event] = {
        listeners: []
      };
    }
    this.events[event].listeners.push(callback);
  }

  removeListener(event: string, callback: (data?: any) => any) {
    // Check if this event not exists
    if (this.events[event] === undefined) {
      return false;
    }
    this.events[event].listeners = this.events[event].listeners.filter(
      (listener: string) => {
        return listener.toString() !== callback.toString();
      }
    );
  }

  dispatch(event: string, data?: any) {
    // Check if this event not exists
    if (this.events[event] === undefined) {
      return false;
    }
    this.events[event].listeners.forEach((listener: any) => {
      listener(data);
    });
  }
}
