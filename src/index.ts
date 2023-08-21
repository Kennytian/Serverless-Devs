import { Command } from 'commander';
import { checkNodeVersion, setProxy } from './utils';
import logger from './logger';
import handleError from './error';
import root from './command';
import onboarding from './onboarding';
import UpdateNotifier from './update-notifier';
import * as utils from '@serverless-devs/utils';

const preRun = () => {
  // 添加环境变量
  process.env.serverless_devs_traceid = utils.traceid();
  // 初始化日志
  logger.initialization();
  // 检查node版本是否过低
  checkNodeVersion();
  // 设置全局代理
  setProxy();
  // 检查更新
  new UpdateNotifier().init().notify();
};

(async () => {
  preRun();
  // 处理 onboarding
  const { _: raw, help, version } = utils.parseArgv(process.argv.slice(2));
  if (raw.length === 0 && !help && !version) {
    return await onboarding();
  }
  // 处理指令
  const program = new Command();
  await root(program);
  await program.parseAsync(process.argv);
})().catch(async error => {
  await handleError(error);
});

process.on('uncaughtException', async err => {
  await handleError(err);
});

process.on('exit', code => {
  logger.debug(`Run traceid: ${process.env.serverless_devs_traceid}`);
  logger.debug(`Process exitCode: ${code}`);
  // fix 光标位置
  logger.loggerInstance.__clear();
});

process.on('SIGINT', () => {
  logger.debug('Process SIGINT');
  process.exit();
});
