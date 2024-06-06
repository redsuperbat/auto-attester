locals {
  namespace = "rsb-apps"
  name      = "auto-attester"
}

terraform {
  required_providers {
    kubernetes = {
      source = "hashicorp/kubernetes"
    }
  }
  backend "kubernetes" {
    namespace     = "terraform-backend"
    secret_suffix = "auto-attester"
    config_path   = "~/.kube/config"
  }
}


provider "kubernetes" {
  config_path = "~/.kube/config"
}



variable "image_tag" {
  type = string
}

variable "username" {
  type = string
}

variable "password" {
  type = string
}

resource "kubernetes_namespace_v1" "ns" {
  metadata {
    name = local.name
  }
}

resource "kubernetes_cron_job_v1" "cron_job" {
  metadata {
    name      = local.name
    namespace = kubernetes_namespace_v1.ns.metadata[0].name
  }


  spec {
    schedule = "33 18 */2 * *"
    job_template {
      metadata {
        name = local.name
      }
      spec {

        template {
          metadata {
            labels = {
              app = local.name
            }
          }

          spec {

            container {
              name  = local.name
              image = "maxrsb/auto-attester:${var.image_tag}"

              env {
                name  = "USERNAME"
                value = var.username
              }

              env {
                name  = "PASSWORD"
                value = var.password
              }

              resources {

                requests = {
                  cpu    = "20m"
                  memory = "5Mi"
                }

              }
            }

          }
        }
      }
    }
  }
}
