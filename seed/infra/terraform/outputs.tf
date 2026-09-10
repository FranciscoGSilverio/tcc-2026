output "repository_url" {
  description = "ECR repository that holds the service image"
  value       = aws_ecr_repository.api.repository_url
}

output "cluster_name" {
  description = "ECS cluster that runs the service"
  value       = aws_ecs_cluster.api.name
}

output "log_group" {
  description = "CloudWatch log group for the service"
  value       = aws_cloudwatch_log_group.api.name
}
