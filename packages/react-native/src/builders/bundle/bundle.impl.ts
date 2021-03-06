import { BuilderContext, createBuilder } from '@angular-devkit/architect';
import { createDirectory, toFileName } from '@nrwl/workspace';
import { JsonObject } from '@angular-devkit/core';
import { from, Observable } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { dirname, join, relative, sep } from 'path';
import { getProjectRoot } from '../../utils/get-project-root';
import { ensureNodeModulesSymlink } from '../../utils/ensure-node-modules-symlink';
import { fork } from 'child_process';

export interface ReactNativeBuildOptions extends JsonObject {
  dev: boolean;
  platform: string;
  entryFile: string;
  bundleOutput: string;
  maxWorkers: number;
  sourceMap: boolean;
}

export interface ReactNativeBuildOutput {
  success: boolean;
}

export default createBuilder<ReactNativeBuildOptions>(run);

function run(
  options: ReactNativeBuildOptions,
  context: BuilderContext
): Observable<ReactNativeBuildOutput> {
  return from(getProjectRoot(context)).pipe(
    tap((root) => {
      // Since cwd is in `apps/[name]` we need to make output dir relative to it
      options.bundleOutput = relative(context.workspaceRoot, root)
        .split(sep)
        .map(() => '..')
        .concat(options.bundleOutput)
        .join(sep);

      createDirectory(dirname(join(root, options.bundleOutput)));
      ensureNodeModulesSymlink(context.workspaceRoot, root);
    }),
    switchMap((root) => runCliBuild(context.workspaceRoot, root, options)),
    map(() => {
      return {
        success: true,
      };
    })
  );
}

function runCliBuild(workspaceRoot, projectRoot, options) {
  return new Promise((resolve, reject) => {
    const cliOptions = createBundleOptions(options);
    const cp = fork(
      join(workspaceRoot, './node_modules/react-native/cli.js'),
      ['bundle', ...cliOptions],
      { cwd: projectRoot }
    );
    cp.on('error', (err) => {
      reject(err);
    });
    cp.on('exit', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(code);
      }
    });
  });
}

function createBundleOptions(options) {
  return Object.keys(options).reduce((acc, _k) => {
    const v = options[_k];
    const k = toFileName(_k);
    if (v === undefined) return acc;
    acc.push(`--${k}`, v);
    return acc;
  }, []);
}
