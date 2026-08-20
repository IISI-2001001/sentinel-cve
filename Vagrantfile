# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure("2") do |config|
  config.vm.box = "generic/rocky9"
  config.vm.hostname = "sentinel-cve"

  config.vm.network "forwarded_port", guest: 3000, host: 3000
  # Expose PostgreSQL so external DB clients (DBeaver/pgAdmin/psql) on the host can connect.
  config.vm.network "forwarded_port", guest: 5432, host: 5432

  config.vm.provider "virtualbox" do |vb|
    vb.memory = 2048
    vb.cpus = 2
  end

  # Default VirtualBox shared folder (vboxsf) is disabled: it requires Guest Additions
  # matching the host VirtualBox version, which frequently fails on generic/* boxes.
  # Instead, the app is deployed by cloning the (public) GitHub repo inside the VM.
  config.vm.synced_folder ".", "/vagrant", disabled: true

  config.vm.provision "shell", inline: <<-SHELL
    set -e
    dnf -y install dnf-plugins-core git
    dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo
    dnf -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable --now docker
    usermod -aG docker vagrant

    APP_DIR=/home/vagrant/sentinel-cve
    if [ ! -d "$APP_DIR" ]; then
      git clone https://github.com/IISI-2001001/sentinel-cve.git "$APP_DIR"
    else
      cd "$APP_DIR" && git pull
    fi
    chown -R vagrant:vagrant "$APP_DIR"

    cd "$APP_DIR"
    if [ ! -f .env ]; then
      cp .env.example .env
      echo "[提示] 已從 .env.example 建立 .env，請編輯 $APP_DIR/.env 填入 GEMINI_API_KEY 後重新執行: cd $APP_DIR && docker compose up -d --build"
    fi

    docker compose up -d --build
  SHELL
end
