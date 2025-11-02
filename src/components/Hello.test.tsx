import { render, screen } from '@testing-library/react';

import { Hello } from './Hello';

describe('<Hello />', () => {
  it('renders greeting message', () => {
    render(<Hello name="世界" />);
    expect(screen.getByRole('status')).toHaveTextContent('こんにちは、世界！');
  });
});
