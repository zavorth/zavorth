{ config, lib, pkgs, ... }:

let
  cfg = config.services.zavorth;
in {
  options.services.zavorth = {
    enable = lib.mkEnableOption "the Zavorth agent service";
    package = lib.mkOption { type = lib.types.package; description = "Package exposing the zavorth executable."; };
    user = lib.mkOption { type = lib.types.str; default = "zavorth"; };
    group = lib.mkOption { type = lib.types.str; default = "zavorth"; };
    workingDirectory = lib.mkOption { type = lib.types.path; default = "/var/lib/zavorth"; };
    environmentFile = lib.mkOption { type = lib.types.nullOr lib.types.path; default = null; };
    extraEnvironment = lib.mkOption { type = lib.types.attrsOf lib.types.str; default = {}; };
  };

  config = lib.mkIf cfg.enable {
    users.groups.${cfg.group} = {};
    users.users.${cfg.user} = { isSystemUser = true; group = cfg.group; home = cfg.workingDirectory; createHome = true; };
    systemd.services.zavorth = {
      description = "Zavorth agent runtime";
      wantedBy = [ "multi-user.target" ];
      after = [ "network-online.target" ];
      wants = [ "network-online.target" ];
      environment = cfg.extraEnvironment;
      serviceConfig = {
        Type = "simple";
        User = cfg.user;
        Group = cfg.group;
        WorkingDirectory = cfg.workingDirectory;
        EnvironmentFile = lib.optional (cfg.environmentFile != null) cfg.environmentFile;
        ExecStart = "${cfg.package}/bin/zavorth start --headless";
        Restart = "on-failure";
        RestartSec = 5;
        NoNewPrivileges = true;
        PrivateTmp = true;
        ProtectSystem = "strict";
        ReadWritePaths = [ cfg.workingDirectory ];
      };
    };
  };
}
