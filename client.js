import isClass from './is-class';

class SinglePlugin {
  constructor(app, name, dependencies) {
    this.app = app;
    this.name = name;
    this.dependencies = dependencies;
    app.plugins[name] = this;
    Object.defineProperty(this, 'config', {
      get() {
        return app.PluginConfigs[name];
      }
    })
  }
  
  dependency(dependency) {
    if (this.dependencies.indexOf(dependency) === -1) throw new Error(`${dependency} is not one of ${JSON.stringify(this.dependencies)}`);
    return this.app.plugins[dependency];
  }
}

export default class ClientParser {
  constructor(app) {
    this.app = app;
    this.app.Middleware = {};
    this.app.Service = {};
    this.app.context.Webview = {};
    this.app.context.AsyncWebview = {};

    Object.defineProperty(this.app.context, 'Service', {
      get() {
        if (this.__ServiceLoader__) return this.__ServiceLoader__;
        this.__ServiceLoader__ = {};
        createContext(this, this.app.Service, this.__ServiceLoader__);
        return this.__ServiceLoader__;
      }
    })
  }

  Controller() {}

  AppRuntime(data) {
    this.app.AppRuntime = data.Bootstrap;
  }

  Bootstrap(data) {
    this.app.Bootstrap = data.App;
  }

  Middleware(Middlewares) {
    for (const path in Middlewares) {
      Reduce(
        this.app.Middleware, 
        path, 
        Middlewares[path], 
        (target, property, value) => {
          if (value.length === 1) return target[property](this.app);
          target[property] = value;
        }
      );
    }
    Object.freeze(this.app.Middleware);
  }

  Service(Services) {
    for (const path in Services) {
      Reduce(
        this.app.Service, 
        path, 
        Services[path], 
        (target, property, value) => target[property] = value
      );
    }
    Object.freeze(this.app.Service);
  }

  AsyncWebview(data) {
    for (const path in data) {
      Reduce(
        this.app.context.AsyncWebview, 
        path, 
        data[path], 
        (target, property, value) => target[property] = value
      );
    }
    Object.freeze(this.app.context.AsyncWebview);
  }

  Webview(data) {
    for (const path in data) {
      Reduce(
        this.app.context.Webview, 
        path, 
        data[path], 
        (target, property, value) => target[property] = value
      );
    }
    Object.freeze(this.app.context.Webview);
  }

  Config(data) {
    const env = this.app.env.charAt(0).toUpperCase() + this.app.env.substring(1);
    if (data[env]) {
      this.app.config = data[env];
      if (typeof this.app.config === 'function') {
        this.app.config = this.app.config(this.app);
      }
    }
  }

  Plugin(data) {
    data.forEach(plugin => {
      const PluginClassModule = new SinglePlugin(this.app, plugin.name, plugin.dependencies);
      if (typeof plugin.exports === 'function') {
        plugin.exports(this.app, PluginClassModule);
      }
    });
  }

  PluginConfigs(data) {
    const env = this.app.env.charAt(0).toUpperCase() + this.app.env.substring(1);
    this.app.PluginConfigs = data[env];
  }
}

function Reduce(object, string, value, callback) {
  const pathSplits = string.split('.');
  pathSplits.reduce((target, property, index) => {
    if (index === pathSplits.length - 1) {
      callback(target, property, value);
    } else {
      if (!target[property]) target[property] = {};
    }
    return target[property];
  }, object);
}

function createContext(ctx, service, target) {
  for (const i in service) {
    if (!isClass(service[i])) {
      target[i] = service[i];
      createContext(ctx, service[i], target[i]);
    } else {
      const context = new Proxy(service[i], {
        get(obj, prop) {
          const res = new obj(ctx);
          if (typeof res[prop] === 'function') return res[prop].bind(res);
          return res[prop];
        }
      });
      target[i] = context;
    }
  }
}