/**
 * Handle API errors and return user-friendly error messages
 */
export function handleAPIError(error: any): string {
  if (error.response) {
    // Server responded with error
    const status = error.response.status;
    const detail = error.response.data?.detail || error.response.data?.message || 'Unknown error';
    
    switch (status) {
      case 400:
        return `Bad Request: ${detail}`;
      case 401:
        return 'Unauthorized. Please log in again.';
      case 403:
        return 'Forbidden. You don\'t have permission.';
      case 404:
        return 'Not found.';
      case 429:
        return 'Too many requests. Please try again later.';
      case 500:
        return `Server error: ${detail}`;
      default:
        return `Error ${status}: ${detail}`;
    }
  } else if (error.request) {
    // Request made but no response
    return 'Network error. Please check your connection.';
  } else {
    // Something else happened
    return error.message || 'An unexpected error occurred';
  }
}

