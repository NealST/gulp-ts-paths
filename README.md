## gulp-tsconfig-paths

### 能力介绍

处理 tsconfig.json 中 paths alias 构建的 gulp 插件

### 如何使用

```typescript
import aliasTsconfigPaths from 'gulp-tsconfig-paths';
import { src, dest } from 'gulp';

const tsCompilerOptions = require('./tsconfig.json').compilerOptions;

src(['src/index.ts']).pipe(aliasTsconfigPaths(tsCompilerOptions)).pipe(dest('lib'))

```
