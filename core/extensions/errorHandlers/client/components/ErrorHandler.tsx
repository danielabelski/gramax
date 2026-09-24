import Error from "@components/Error";
import React, { type ReactNode } from "react";
import sendBug from "../../../bugsnag/logic/sendBug";

export interface ErrorHandlerProps {
	children: ReactNode;
	resetKey?: string;
}

interface ErrorHandlerState {
	error: Error;
}

class ErrorHandler<
	P extends ErrorHandlerProps = ErrorHandlerProps,
	S extends ErrorHandlerState = ErrorHandlerState,
> extends React.Component<P, S> {
	constructor(props: P) {
		super(props);
		this.state = { error: null } as S;
	}

	static getDerivedStateFromError(error: Error): ErrorHandlerState {
		return { error };
	}

	override componentDidCatch(error: Error): void {
		void sendBug(error);
	}

	override componentDidUpdate(previousProps: P): void {
		if (this.state.error && previousProps.resetKey !== this.props.resetKey) this.setState({ error: null } as S);
	}

	renderError() {
		return <Error error={this.state.error} />;
	}

	override render() {
		if (this.state.error) {
			return this.renderError();
		}
		return this.props.children;
	}
}

export default ErrorHandler;
