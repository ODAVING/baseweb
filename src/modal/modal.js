/*
Copyright (c) 2018 Uber Technologies, Inc.

This source code is licensed under the MIT license found in the
LICENSE file in the root directory of this source tree.
*/
// @flow
/* global document */
import * as React from 'react';
import ReactDOM from 'react-dom';

import {getOverride, getOverrideProps} from '../helpers/overrides';
import {SIZE, ROLE, CLOSE_SOURCE} from './constants';
import {ownerDocument} from './utils';
import {
  Root as StyledRoot,
  Backdrop as StyledBackdrop,
  Dialog as StyledDialog,
  DialogContainer as StyledDialogContainer,
  Close as StyledClose,
} from './styled-components';
import {CloseIcon} from './close-icon';

import type {
  ModalPropsT,
  ModalStateT,
  SharedStylePropsArgT,
  CloseSourceT,
  ElementRefT,
} from './types';

class Modal extends React.Component<ModalPropsT, ModalStateT> {
  static defaultProps: $Shape<ModalPropsT> = {
    animate: true,
    autofocus: true,
    closeable: true,
    isOpen: false,
    overrides: {},
    role: ROLE.dialog,
    size: SIZE.default,
  };

  animateOutTimer: ?TimeoutID;
  animateStartTimer: ?AnimationFrameID;
  lastFocus: ?HTMLElement = null;
  _refs: {[string]: ElementRefT} = {};

  state = {
    isVisible: false,
    mounted: false,
  };

  componentDidMount() {
    this.setState({mounted: true});
  }

  componentWillUnmount() {
    this.removeDomEvents();
    this.clearTimers();
  }

  componentDidUpdate(prevProps: ModalPropsT, prevState: ModalStateT) {
    const {isOpen} = this.props;
    if (
      // If isOpen is changing *or* we just mounted and modal should be open
      isOpen !== prevProps.isOpen ||
      (isOpen && this.state.mounted && !prevState.mounted)
    ) {
      if (isOpen) {
        this.open();
      } else {
        this.close();
      }
    }
  }

  addDomEvents() {
    if (__BROWSER__) {
      document.addEventListener('keyup', this.onDocumentKeyPress);
    }
  }

  removeDomEvents() {
    if (__BROWSER__) {
      document.removeEventListener('keyup', this.onDocumentKeyPress);
    }
  }

  onDocumentKeyPress = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') {
      return;
    }

    // Ignore events that have been `event.preventDefault()` marked.
    if (event.defaultPrevented) {
      return;
    }

    if (!this.props.closeable) {
      return;
    }

    this.close(CLOSE_SOURCE.escape);
  };

  onBackdropClick = () => {
    if (!this.props.closeable) {
      return;
    }
    this.close(CLOSE_SOURCE.backdrop);
  };

  onCloseClick = () => {
    this.close(CLOSE_SOURCE.closeButton);
  };

  clearTimers() {
    if (this.animateOutTimer) {
      clearTimeout(this.animateOutTimer);
    }
    if (this.animateStartTimer) {
      // eslint-disable-next-line cup/no-undef
      cancelAnimationFrame(this.animateStartTimer);
    }
  }

  open() {
    // Store last focused item (we'll return focus after closing for a11y)
    this.captureLastFocus();
    this.autoFocus();

    // Sometimes scroll starts past zero, possibly due to animation
    // Reset scroll to 0 (other libraries do this as well)
    const rootRef = this.getRef('Root').current;
    if (rootRef) {
      rootRef.scrollTop = 0;
    }

    // Clear any existing timers (like previous animateOutTimer)
    this.clearTimers();
    this.addDomEvents();

    // eslint-disable-next-line cup/no-undef
    this.animateStartTimer = requestAnimationFrame(() => {
      this.setState({isVisible: true});
    });
  }

  close(source?: CloseSourceT) {
    // If there's no source, it just means the isOpen prop changed. No need to call onClose.
    if (this.props.onClose && source) {
      this.props.onClose(source);
    }
    this.removeDomEvents();
    this.animateOutTimer = setTimeout(this.animateOutComplete, 500);
    this.restoreLastFocus();
  }

  captureLastFocus = () => {
    this.lastFocus = ownerDocument(this.getMountNode()).activeElement;
  };

  restoreLastFocus = () => {
    if (this.lastFocus) {
      // Not all elements in IE11 can focus
      if (this.lastFocus.focus) {
        this.lastFocus.focus();
      }
      this.lastFocus = null;
    }
  };

  autoFocus = () => {
    if (!this.props.autofocus) {
      return;
    }
    const dialog = this.getRef('Dialog').current;
    if (!dialog) {
      return;
    }
    dialog.focus();
  };

  animateOutComplete = () => {
    this.setState({
      isVisible: false,
    });
  };

  getSharedProps(): $Diff<SharedStylePropsArgT, {children: React.Node}> {
    const {animate, isOpen, size, role, closeable} = this.props;
    return {
      $animate: animate,
      $isVisible: this.state.isVisible,
      $isOpen: Boolean(isOpen),
      $size: size,
      $role: role,
      $closeable: Boolean(closeable),
    };
  }

  getMountNode(): HTMLElement {
    const {mountNode} = this.props;
    if (mountNode) {
      return mountNode;
    }
    // Flow thinks body could be null (cast through any)
    // eslint-disable-next-line flowtype/no-weak-types
    return ((document.body: any): HTMLBodyElement);
  }

  getChildren() {
    const {children} = this.props;
    return typeof children === 'function' ? children() : children;
  }

  getRef(component: string): ElementRefT {
    const overrideProps: {$ref?: ElementRefT} = getOverrideProps(
      this.props.overrides.Dialog,
    );
    const overrideRef = overrideProps.$ref;
    if (overrideRef) {
      return overrideRef;
    }
    if (!this._refs[component]) {
      this._refs[component] = React.createRef();
    }
    return this._refs[component];
  }

  renderModal() {
    const {overrides = {}, closeable, role} = this.props;

    const {
      Root: RootOverride,
      Dialog: DialogOverride,
      DialogContainer: DialogContainerOverride,
      Backdrop: BackdropOverride,
      Close: CloseOverride,
    } = overrides;

    const Root = getOverride(RootOverride) || StyledRoot;
    const Backdrop = getOverride(BackdropOverride) || StyledBackdrop;
    const DialogContainer =
      getOverride(DialogContainerOverride) || StyledDialogContainer;
    const Dialog = getOverride(DialogOverride) || StyledDialog;
    const Close = getOverride(CloseOverride) || StyledClose;

    const sharedProps = this.getSharedProps();
    const children = this.getChildren();

    return (
      <Root
        role={role}
        $ref={this.getRef('Root')}
        {...sharedProps}
        {...getOverrideProps(RootOverride)}
      >
        <Backdrop
          onClick={this.onBackdropClick}
          {...sharedProps}
          {...getOverrideProps(BackdropOverride)}
        />
        <DialogContainer
          {...sharedProps}
          {...getOverrideProps(DialogContainerOverride)}
        >
          <Dialog
            tabIndex="-1"
            aria-modal={
              // aria-modal replaces the need to apply aria-hidden="true" to all other page
              // content underneath the modal.
              // https://www.w3.org/TR/wai-aria-practices-1.1/examples/dialog-modal/dialog.html
              'true'
            }
            role={
              // Adding role="document" to dialogs in modals is recommended
              // https://github.com/twbs/bootstrap/issues/15875
              'document'
            }
            $ref={this.getRef('Dialog')}
            {...sharedProps}
            {...getOverrideProps(DialogOverride)}
          >
            {closeable ? (
              <Close
                aria-label="Close"
                onClick={this.onCloseClick}
                {...sharedProps}
                {...getOverrideProps(CloseOverride)}
              >
                <CloseIcon />
              </Close>
            ) : null}
            {children}
          </Dialog>
        </DialogContainer>
      </Root>
    );
  }

  render() {
    // Only render modal on the browser (portals aren't supported server-side)
    if (!this.state.mounted) {
      return null;
    }
    // Only render the modal if its isOpen is passed, or isVisible is true (still animating)
    if (!this.props.isOpen && !this.state.isVisible) {
      return null;
    }
    const mountNode = this.getMountNode();
    if (!mountNode) {
      return null;
    }
    return ReactDOM.createPortal(this.renderModal(), mountNode);
  }
}

export default Modal;