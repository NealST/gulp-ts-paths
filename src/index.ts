// gulp 插件，用来支持模块构建时处理 tsconfig 中的 paths alias
import path from "path";
import oStream from "o-stream";
import PluginError from "plugin-error";

const PLUGIN_NAME = "gulp-tsconfig-paths";

function getImportInLine(filePath, line, index) {
  let matches = line.match(/from ("|')([^.]+)("|')/);
  if (!matches) return null;
  let match = matches[2];
  return {
    lineIndex: index,
    target: match,
    filePath: filePath,
  };
}

function getImports(filePath, lines) {
  let results = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let importAlias = getImportInLine(filePath, line, i);
    if (!importAlias) {
      continue;
    }
    results.push(importAlias);
  }
  return results;
}

function findPathsAlias(tsconfigPaths, importTarget) {
  const aliasList = Object.keys(tsconfigPaths);
  if (aliasList.length === 0) {
    return;
  }
  let theAlias = "";
  aliasList.some((aliasItem) => {
    const aliasStr = aliasItem.replace("*", "");
    if (importTarget.indexOf(aliasStr) >= 0) {
      theAlias = aliasItem;
      return true;
    }
    return false;
  });
  return theAlias;
}

function resolveImports(lines, imports, compilerOptions) {
  for (let importAlias of imports) {
    let line = lines[importAlias.lineIndex];
    const importTarget = importAlias.target;
    const theAlias = findPathsAlias(compilerOptions.paths, importTarget);
    let aliasPaths = compilerOptions.paths[theAlias];
    if (!aliasPaths) continue;
    if (aliasPaths.length > 1) {
      throw new PluginError(
        PLUGIN_NAME,
        `Multiple resolutions for the same alias is not supported. Alias: ${importAlias.alias}`
      );
    }
    const aliasPath = aliasPaths[0].replace('*', '').replace('./', `${process.cwd()}/`);
    const theAliasStr = theAlias.replace("*", "");
    const absoluteImportTargetPath = importTarget.replace(theAliasStr, aliasPath);
    const fileDirPath = path.dirname(importAlias.filePath);
    let theTargetRelativePath = path.relative(fileDirPath, absoluteImportTargetPath);
    if (theTargetRelativePath.indexOf('./') < 0) {
      // 如果两个文件在同一文件夹下，那么获取到的相对路径会不带 ./, 这种情况下 ts 构建会报模块找不到，需要特殊处理
      theTargetRelativePath = `./${theTargetRelativePath}`;
    }
    lines[importAlias.lineIndex] = line.replace(importTarget, theTargetRelativePath);
  }
}

function throwIfStream(file) {
  if (file.isStream()) {
    throw new PluginError(PLUGIN_NAME, "Streams are not supported.");
  }
}

const tsconfigPathsPlugin = function (compilerOptions) {
  if (!compilerOptions) {
    throw new PluginError(
      PLUGIN_NAME,
      "tsconfig compilerOptions must be passed"
    );
  }
  return oStream.transform({
    onEntered: (args) => {
      let file: any = args.object;
      throwIfStream(file);
      if (!compilerOptions.paths || file.isNull() || !file.contents) {
        // 如果没有配置 paths 或者文件内容无效，则不做任何处理
        args.output.push(file);
        return;
      }
      if (!file.path) {
        throw new PluginError(
          PLUGIN_NAME,
          "Received file with no path. Files must have path to be resolved."
        );
      }
      let lines = file.contents.toString().split("\n");
      let imports = getImports(file.path, lines);
      if (imports.length === 0) {
        args.output.push(file);
        return;
      }
      resolveImports(lines, imports, compilerOptions);
      file.contents = Buffer.from(lines.join("\n"));
      args.output.push(file);
    },
  });
};

export default tsconfigPathsPlugin;
