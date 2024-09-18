export const logEvent = (eventName: string, data?: any) => {
  console.log(
    JSON.stringify({
      event: eventName,
      timestamp: new Date().toISOString(),
      ...data,
    })
  );
};
