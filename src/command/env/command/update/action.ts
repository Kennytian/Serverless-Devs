import { each, find, get, map, pick } from 'lodash';
import logger from '@/logger';
import { IOptions } from './type';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import { ENVIRONMENT_FILE_NAME } from '@serverless-devs/parse-spec';
import * as utils from '@serverless-devs/utils';
import path from 'path';
import { assert } from 'console';
import { ENV_COMPONENT_KEY, ENV_COMPONENT_NAME, ENV_KEYS } from '../../constant';
import loadComponent from "@serverless-devs/load-component";
import Credential from "@serverless-devs/credential";

class Action {
  constructor(private options: IOptions) {
    logger.debug(`s env update --option: ${JSON.stringify(options)}`);
  }
  async start() {
    const { template = path.join(process.cwd(), ENVIRONMENT_FILE_NAME), ...rest } = this.options;
    const newData = pick(rest, ENV_KEYS);
    const componentName = utils.getGlobalConfig(ENV_COMPONENT_KEY, ENV_COMPONENT_NAME);
    const componentLogger = logger.loggerInstance.__generate(componentName);
    const instance = await loadComponent(componentName, { logger: componentLogger });

    assert(fs.existsSync(template), `The file ${template} was not found`);
    const { project, environments } = utils.getYamlContent(template);
    const isExist = find(environments, item => item.name === this.options.name);
    assert(isExist, `The environment ${this.options.name} was not found`);

    // Updating Cloud Environment
    const { access, ...envProps } = isExist;
    const inputs = {
      cwd: process.cwd(),
      userAgent: utils.getUserAgent({ component: instance.__info }),
      props: {
        project,
        ...envProps,
      },
      command: 'env',
      args: ['update'],
      getCredential: async () => {
        const res = await new Credential({ logger: componentLogger }).get(access);
        const credential = get(res, 'credential', {});
        each(credential, v => {
          logger.loggerInstance.__setSecret([v]);
        });
        return credential;
      },
    };

    const { 'project': p, ...envResult } = await instance.env(inputs);
    const newEnvironments = map(environments, item => {
      if (item.name === this.options.name) {
        return {
          ...item,
          ...newData,
          ...envResult,
        };
      }
      return item;
    });
    fs.writeFileSync(template, yaml.dump({ project, environments: newEnvironments }));
    logger.write('Environment updated successfully');
  }
}

export default Action;
