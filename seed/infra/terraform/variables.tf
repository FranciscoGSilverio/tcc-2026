variable "region" {
  description = "AWS region for the service"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "staging"
}

variable "service_name" {
  description = "Name used to tag every resource"
  type        = string
  default     = "meeting-rooms-api"
}

variable "container_port" {
  description = "Port the container listens on"
  type        = number
  default     = 3000
}

variable "desired_count" {
  description = "Number of tasks to keep running"
  type        = number
  default     = 2
}
