const fs = require('fs');
const path = require('path');
const utils = require('@clusic/utils');
const intersect = require('@evio/intersect');
module.exports = class Plugin {
  constructor(env) {
    this.env = env;
    this.imports = [];
    this.dictionaries = [];
    this.cwd = process.cwd();
  }

  parse() {
    const data = utils.loadFile(path.resolve(this.cwd, 'plugin', 'index.json'));
    const result = this.list(data);
    this.dictionaries = result.map(res => res.dir);
    this.imports = result.filter(res => !!res.filePath);
  }

  list(data) {
    const pluginTrees = {};
    for (const i in data) {
      const plugin = data[i];
      if (plugin.enable === undefined) plugin.enable = true;
      if (!plugin.enable) continue;
      if (plugin.env === undefined) plugin.env = this.env;
      if (!Array.isArray(plugin.env)) plugin.env = [plugin.env];
      if (plugin.env.indexOf(this.env) === -1) continue;
      const pluginNodeModuleExports = utils.loadFile(i + '/package.json');
      if (!plugin.dependencies) plugin.dependencies = [];
      if (!Array.isArray(plugin.dependencies)) plugin.dependencies = [plugin.dependencies];
      if (pluginNodeModuleExports.plugin && pluginNodeModuleExports.plugin.dependencies) {
        if (!Array.isArray(pluginNodeModuleExports.plugin.dependencies)) pluginNodeModuleExports.plugin.dependencies = [pluginNodeModuleExports.plugin.dependencies];
        for (let j = 0; j < pluginNodeModuleExports.plugin.dependencies.length; j++) {
          if (plugin.dependencies.indexOf(pluginNodeModuleExports.plugin.dependencies[i]) === -1) {
            plugin.dependencies.push(pluginNodeModuleExports.plugin.dependencies[i]);
          }
        }
      }
      let dir, filePath;
      if (path.isAbsolute(i)) { dir = i; }
      else if (i.charAt(0) === '.') { dir = path.resolve(this.cwd, 'plugin', i); }
      else { dir = path.resolve(this.cwd, 'node_modules', i); }
      filePath = path.resolve(dir, 'app.js');
      filePath = fs.existsSync(filePath) ? filePath : null;
      pluginTrees[i] = {
        dir,
        dependencies: plugin.dependencies,
        filePath
      }
    }
    return this.sortPluginDependencies(pluginTrees);
  }

  sortPluginDependencies(tree) {
    const result = [];
    const keys = Object.keys(tree);
    let j = keys.length;
    while (j--) {
      const obj = tree[keys[j]];
      if (obj.dependencies.length) {
        const res = intersect(obj.dependencies, keys);
        if (res.removes.length) {
          throw new Error(`插件[${keys[j]}]依赖模块不存在：${res.removes.join(',')}`);
        }
      }
      Object.defineProperty(obj, 'deep', {
        get() {
          if (!obj.dependencies.length) return 0;
          return Math.max(...obj.dependencies.map(d => tree[d] ? tree[d].deep : 0)) + 1;
        }
      });
    }
  
    for (const i in tree) {
      tree[i].name = i;
      result.push(tree[i]);
    }
  
    return result.sort((a, b) => a.deep - b.deep);
  }
}