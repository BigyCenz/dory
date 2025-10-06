export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');
  window.location.href = '/';
};