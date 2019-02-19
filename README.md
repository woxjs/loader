# @wox / loader

wox 动态loader加载器，它是一套基于webpack创建的插件。

## Install

```shell
npm i @wox/loader -D
```

## Usage

在`webpack.config.js`配置中写入如下代码：

```javascript
import WoxRuntimeLoader from '@wox/loader';

export default {
  ...
  plugins: [
    new WoxRuntimeLoader(true)
  ],
  ...
}
```

它有一个参数：是否监听，如果开启，那么表示在开发模式下。