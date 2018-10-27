# @wox / loader

wox规范架构加载器。分`server`与`client`端的解析引擎。

## Install

```shell
npm i @wox/loader
```

## Usage

分`service`与`client`端的解析引擎。

```javascript
import Server from '@wox/loader/server';
import Client from '@wox/loader/client';
```

server端主要用于webpack的插件化，解决自动loader文件夹的策略。client主要对server端解析的数据进行规范解析。同时提供插件化能力。

## Server

创建webpack插件化对象，它有一个参数，布尔值，表示是否开启监听。

```javascript
import WoxWebpackRuntimePlugin from '@wox/loader/server';
const wox = new WoxWebpackRuntimePlugin(true);
wox.addDictionary(__dirname);
wox.loadCommonCase();
```

以后你可以将`wox`放置到webpack的plugins中。

```javascript
var webpack_options = {
  plugins: [
    wox,
  ]
}
```

### wox.loadCommonCompiler

注入一个通用的编译器

```javascript
wox.loadCommonCompiler(code, rule, deep);
// code: {string} 编译器标识名
// rule: {array} 路径解析规范  来源于 'ignore' 组件
// deep: {number} 解析深度 默认：2
```

### wox.addCompiler

添加一个编译器

```javascript
wox.addCompiler(compiler);
// compiler: {function} 编译器内容回调
```

### wox.setParser

设置一个基于编译器的一个解析器

```javascript
wox.setParser(code, callback);
// code: {string} 编译器标识名
// callback: {function} 处理的回调函数
// callback拥有2个参数(id, filePath) 返回值决定编译的最终内容
```

### wox.addDictionary

添加一个新的编译文件夹地址

```javascript
wox.addDictionary(__dirname__);
```

### wox.extract

抽取文件的内容到固定文件

```javascript
wox.extract();
```

### wox.exit

退出编译

```javascript
wox.exit();
```

## Plugin maker

在插件中如果存在`.wox.js`文件，那么它将被程序调用，用来处理插件的自定义server端行为。