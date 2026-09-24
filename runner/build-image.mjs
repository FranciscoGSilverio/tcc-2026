#!/usr/bin/env node
// Builds the session image once, deliberately, and prints its digest.
//
// Sessions do not build. The protocol (section 3.4) holds the container
// image identical across every session, and the runner used to rebuild
// before each one -- which recorded eight different image_digest values
// across the first eight sessions, because the build context is runner/
// and that directory changed constantly during development. The claim
// was asserted by the protocol and contradicted by the data.
//
// Splitting build from run makes the constant verifiable instead: every
// session records the digest of the one image that exists, and
// run-session.mjs refuses when that digest stops matching the dataset.
import { SESSION_IMAGE, buildImage, imageId } from './lib/container.mjs';

buildImage();
process.stdout.write(`${SESSION_IMAGE}\n${imageId(SESSION_IMAGE)}\n`);
