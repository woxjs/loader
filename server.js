const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const chokidar = require('chokidar');
const dataWatch = require('datawatcher');
const ignore = require('ignore');
const PluginResolver = require('./plugin');
const globby = require('globby');
const utils = require('@clusic/utils');

module.exports = class WebpackDictionaryWatcher {
  constructor(watch) {
    this.directories = [];
    this.compilers = [];
    this.result = {};
    this.cacheFile = path.resolve(process.cwd(), '.wox.json');
    this.canWatch = watch;
    this.watchers = [];
    this.parses = {};
    this.env = process.env.NODE_ENV || 'development';
    this.plugin = new PluginResolver(this.env);

    const watcher = new dataWatch({});
    this.result = watcher.getData();
    watcher.watch('*', () => this.buildFile());
    this.addDictionary(process.cwd());
  }

  loadCommonCompiler(property, conditions, offset = 2, pluginWatchCallback) {
    conditions = Array.isArray(conditions) ? conditions : [conditions];
    const ig = ignore().add(conditions);
    this.addCompiler((data, dictionary, watcher) => {
      if (!data[property]) data[property] = {};
      const filePaths = globby.sync(conditions, { cwd: dictionary });
      filePaths.forEach(file => {
        const name = this.defaultHump(file).slice(offset).join('.');
        data[property][name] = path.resolve(dictionary, file);
      });
      if (watcher) {
        watcher.on('add', file => {
          const relativePath = path.relative(dictionary, file);
          if (ig.ignores(relativePath)) {
            const name = this.defaultHump(relativePath).slice(offset).join('.');
            data[property][name] = file;
          }
        });
        watcher.on('unlink', file => {
          const relativePath = path.relative(dictionary, file);
          if (ig.ignores(relativePath)) {
            const name = this.defaultHump(relativePath).slice(offset).join('.');
            if (data[property][name]) {
              delete data[property][name];
            }
          }
        });
        if (pluginWatchCallback) {
          watcher.on('change', file => {
            const relativePath = path.relative(dictionary, file);
            if (ig.ignores(relativePath)) {
              const name = this.defaultHump(relativePath).slice(offset).join('.');
              pluginWatchCallback(name, file);
            }
          });
        }
      }
    })
  }

  loadCommonCase() {
    this.plugin.parse();
    this.plugin.dictionaries.forEach(dir => {
      this.addDictionary(dir);
      const compilerPath = path.resolve(dir, '.wox.js');
      if (fs.existsSync(compilerPath)) {
        const compileExports = utils.loadFile(compilerPath);
        if (typeof compileExports === 'function') {
          compileExports(this);
        }
      }
    });
    this.loadCommonCompiler('Controller', ['app/controller/**/*.js']);
    this.loadCommonCompiler('Middleware', ['app/middleware/**/*.js']);
    this.loadCommonCompiler('Service', ['app/service/**/*.js']);
    this.loadCommonCompiler('Component', ['app/components/**/*.jsx', 'app/components/**/*.vue', 'app/components/**/*.js']);
    this.loadCommonCompiler('AsyncComponent', ['app/async-components/**/*.jsx', 'app/async-components/**/*.vue', 'app/async-components/**/*.js']);
    this.loadCommonCompiler('Webview', ['app/webview/**/*.vue', 'app/webview/**/*.jsx']);
    this.loadCommonCompiler('AsyncWebview', ['app/async-webview/**/*.vue', 'app/async-webview/**/*.jsx']);
    this.loadCommonCompiler('Bootstrap', ['app.vue', 'app.jsx'], 0);
    this.loadCommonCompiler('AppRuntime', ['bootstrap.js'], 0);
    this.loadCommonCompiler('Config', [`config/${this.env}.js`, `config/${this.env}.json`], 1);
    this.loadCommonCompiler('PluginConfigs', [`plugin/${this.env}.json`], 1);
    this.setParser('AsyncWebview', (id, filePath) => {
      return `<code>(function() { async function ${id}(){ return (await import('${filePath}')).default; }; Object.defineProperty(${id}, 'async', { get() {return true;} }); return ${id}; })(),</code>`
    });
    this.setParser('AsyncComponent', (id, filePath) => {
      return `<code>(function() { function ${id}(){ return import('${filePath}'); }; Object.defineProperty(${id}, 'async', { get() {return true;} }); return ${id}; })(),</code>`
    });
    return this;
  }

  setParser(name, callback) {
    this.parses[name] = callback;
    return this;
  }

  buildPackageFile() {
    fse.outputFileSync(
      this.cacheFile, 
      JSON.stringify(this.result, null, 2), 
      'utf8'
    );
  }

  buildFile() {
    const imports = [], result = {};
    let id = 0;
    for (const i in this.result) {
      const channel = this.result[i];
      result[i] = {};
      for (const j in channel) {
        const _id = id++;
        if (this.parses[i]) {
          result[i][j] = this.parses[i]('x_' + _id, channel[j]);
        } else {
          imports.push(`import x_${_id} from "${channel[j]}";`);
          result[i][j] = `{x_${_id}}`;
        }
      }
    }
    result.Plugin = [];
    this.plugin.imports.forEach(plugin => {
      const _id = id++;
      imports.push(`import x_${_id} from "${plugin.filePath}";`);
      result.Plugin.push({
        exports: `{x_${_id}}`,
        name: plugin.name,
        dependencies: plugin.dependencies
      });
    });
    let str = '';
    str += imports.join('\n');
    str += '\n';
    str += `export default ${JSON.stringify(result, null, 2)};`
      .replace(/\"\{x_(\d+)\}\"/g, 'x_$1')
      .replace(/\"\<code\>/g, '')
      .replace(/\<\/code\>\"/g, '');
    fse.outputFileSync(path.resolve(process.cwd(), '.wox.js'), str, 'utf8');
  }

  addDictionary(dir) {
    if (this.directories.indexOf(dir) === -1) {
      this.directories.push(dir);
    }
    return this;
  }

  addCompiler(compiler) {
    this.compilers.push(compiler);
    return this;
  }

  extract() {
    const directories = this.directories.slice(0).concat(this.plugin.dictionaries);
    directories.forEach(dictionary => {
      const watcher = this.canWatch 
        ? chokidar.watch(dictionary, { ignored: /node_modules/ }) 
        : null;
      this.watchers.push(watcher);
      this.compilers.forEach(compiler => compiler(this.result, dictionary, watcher));
    });
    return this;
  }

  exit() {
    this.watchers.forEach(watcher => watcher && watcher.close());
  }

  apply(compiler) {
    if (process.env.NODE_ENV === 'development') {
      compiler.plugin('afterPlugins', () => this.extract());
      compiler.plugin('watchClose', () => this.exit());
    } else {
      compiler.plugin('afterPlugins', () => {
        this.extract();
        this.buildFile();
      });
    }
  }

  defaultHump(filePath, caseStyle) {
    const properties = filePath.substring(0, filePath.lastIndexOf('.')).split('/');
    return properties.map(property => {
      if (!/^[a-z][a-z0-9_-]*$/i.test(property)) throw new Error(`${property} is not match 'a-z0-9_-' in ${filePath}`);
      property = property.replace(/[_-][a-z0-9]/ig, s => s.substring(1).toUpperCase());
      let first = property.charAt(0);
      const next = property.substring(1);
      if (caseStyle === 'lower') {
        first = first.toLowerCase();
      } else {
        first = first.toUpperCase();
      }
      return first + next;
    });
  }
}