export const initialStatus = {
  loading: true,
  error: '',
  data: null,
}

export const getFirebirdError = (error) =>
  error.response?.data?.message ||
  error.response?.data?.data?.error ||
  error.message ||
  'Unable to connect to the Firebird database.'
