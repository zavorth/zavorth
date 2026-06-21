{
  description = "Zavorth - TypeScript/Node.js application";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    {
      nixosModules.default = import ./nixos-module.nix;
      nixosModules.zavorth = self.nixosModules.default;
    }
    // flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        nodejs = pkgs.nodejs_22;
      in
      {
        packages.default = pkgs.buildNpmPackage {
          pname = "zavorth";
          version = "1.1.0";
          src = ../..;

          npmDepsHash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

          inherit nodejs;

          buildPhase = ''
            runHook preBuild
            npm run build
            runHook postBuild
          '';

          installPhase = ''
            runHook preInstall
            mkdir -p $out/bin $out/lib/zavorth
            cp -r dist $out/lib/zavorth/
            cp -r node_modules $out/lib/zavorth/
            cp package.json $out/lib/zavorth/
            ln -s $out/lib/zavorth/dist/host.js $out/bin/zavorth
            runHook postInstall
          '';

          meta = {
            description = "Zavorth application";
            license = pkgs.lib.licenses.mit;
            platforms = pkgs.lib.platforms.unix;
          };
        };

        devShells.default = pkgs.mkShell {
          buildInputs = [
            nodejs
            pkgs.nodePackages.npm
            pkgs.nodePackages.typescript
          ];

          shellHook = ''
            echo "Zavorth development shell"
            echo "Node.js $(node --version)"
            echo "npm $(npm --version)"
          '';
        };
      }
    );
}
