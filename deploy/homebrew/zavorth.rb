class Zavorth < Formula
  desc "Zavorth application"
  homepage "https://github.com/zavorth/zavorth"
  url "https://github.com/zavorth/zavorth/releases/download/v1.1.0/zavorth-1.1.0.tar.gz"
  sha256 "PLACEHOLDER_SHA256"
  license "MIT"

  depends_on "node@22"

  def install
    system "npm", "ci", "--ignore-scripts"
    system "npm", "run", "build"

    libexec.install "dist", "node_modules", "package.json"
    bin.install_symlink "#{libexec}/dist/host.js" => "zavorth"
  end

  service do
    run [opt_bin/"zavorth"]
    keep_alive true
    log_path var/"log/zavorth/stdout.log"
    error_log_path var/"log/zavorth/stderr.log"
    working_dir var/"lib/zavorth"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/zavorth --version")
  end
end
