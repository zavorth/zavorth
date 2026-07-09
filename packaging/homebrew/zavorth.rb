class Zavorth < Formula
  desc "Local-first AI agent runtime with governed tools"
  homepage "https://github.com/zavorth/zavorth"
  version "2.0.0"
  license "MIT"

  on_macos do
    on_intel do
      url "https://github.com/zavorth/zavorth/releases/download/v#{version}/zavorth-darwin-x64.tar.gz"
      sha256 "PLACEHOLDER_SHA256_DARWIN_X64"
    end
    on_arm do
      url "https://github.com/zavorth/zavorth/releases/download/v#{version}/zavorth-darwin-arm64.tar.gz"
      sha256 "PLACEHOLDER_SHA256_DARWIN_ARM64"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/zavorth/zavorth/releases/download/v#{version}/zavorth-linux-x64.tar.gz"
      sha256 "PLACEHOLDER_SHA256_LINUX_X64"
    end
    on_arm do
      url "https://github.com/zavorth/zavorth/releases/download/v#{version}/zavorth-linux-arm64.tar.gz"
      sha256 "PLACEHOLDER_SHA256_LINUX_ARM64"
    end
  end

  def install
    bin.install "zavorth"
    libexec.install "skill-library" if File.exist?("skill-library")
    libexec.install "native" if File.exist?("native")

    (bin/"zavorth").write_env_script bin/"zavorth", {}

    bash_completion.install "completions/zavorth.bash" if File.exist?("completions/zavorth.bash")
    zsh_completion.install "completions/_zavorth" if File.exist?("completions/_zavorth")
    fish_completion.install "completions/zavorth.fish" if File.exist?("completions/zavorth.fish")
  end

  test do
    assert_match "Zavorth", shell_output("#{bin}/zavorth --version")
  end
end
