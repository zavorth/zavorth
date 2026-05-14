import {
  AutomaticBrowserTool,
  type AutomaticBrowserDoctorReport,
} from './tools/AutomaticBrowserTool.js';

type AutomaticBrowserDoctorRuntime = {
  createTool?: () => Pick<AutomaticBrowserTool, 'diagnose'>;
};

export class AutomaticBrowserDoctorService {
  private readonly createTool: () => Pick<AutomaticBrowserTool, 'diagnose'>;

  constructor(runtime: AutomaticBrowserDoctorRuntime = {}) {
    this.createTool = runtime.createTool || (() => new AutomaticBrowserTool());
  }

  public async run(): Promise<AutomaticBrowserDoctorReport> {
    const tool = this.createTool();
    return tool.diagnose();
  }
}
