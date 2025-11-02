import { FC } from 'react';

type HelloProps = {
  name: string;
};

export const Hello: FC<HelloProps> = ({ name }) => {
  return <p role="status">こんにちは、{name}！</p>;
};
