locals {
  tags = {
    Service     = var.service_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_ecr_repository" "api" {
  name                 = var.service_name
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.tags
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${var.service_name}-${var.environment}"
  retention_in_days = 30
  tags              = local.tags
}

resource "aws_ecs_cluster" "api" {
  name = "${var.service_name}-${var.environment}"
  tags = local.tags
}
